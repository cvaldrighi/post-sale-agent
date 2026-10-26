import type { ActionsService, RefundProposal } from '../../actions/actions.service';
import type { PendingAction } from '../../actions/entities/pending-action.entity';
import { OrdersApiError, type OrdersClient } from '../../orders-client/orders.client';
import type { Order, Payment } from '../../orders-client/orders.schemas';
import { createRefundTools } from './refund-tools';
import { ToolRegistry, type ToolContext } from './tool';

const ana: ToolContext = { conversationId: 'conv-1', customerId: 'cust_001', correlationId: 'corr-1' };

const order = {
  id: 'ord_1001',
  customerId: 'cust_001',
  customer: { name: 'Ana Souza', document: '123.456.789-09' },
  status: 'delayed',
  items: [{ sku: 'FONE', name: 'Fone de ouvido', quantity: 1, unitPriceCents: 18990 }],
  totalCents: 18990,
  currency: 'BRL',
  createdAt: '2026-10-10T13:00:00.000Z',
  estimatedDeliveryDate: '2026-10-17',
  deliveredAt: null,
} as Order;

const payment = {
  id: 'pay_1001',
  orderId: 'ord_1001',
  method: 'pix',
  status: 'confirmed',
  amountCents: 18990,
  refundedAmountCents: 0,
  currency: 'BRL',
  paidAt: '2026-10-10T13:02:00.000Z',
  cardLast4: null,
} as Payment;

interface Overrides {
  order?: Partial<Order>;
  payment?: Partial<Payment>;
  getOrder?: () => Promise<Order>;
}

function setup(overrides: Overrides = {}) {
  const proposals: RefundProposal[] = [];
  const orders = {
    getOrder: overrides.getOrder ?? (async () => ({ ...order, ...overrides.order })),
    getPayment: async () => ({ ...payment, ...overrides.payment }),
    createRefund: async () => {
      throw new Error('a ferramenta nunca deve estornar');
    },
  } as unknown as OrdersClient;
  const actions = {
    proposeRefund: async (proposal: RefundProposal) => {
      proposals.push(proposal);
      return {
        id: 'action-1',
        ...proposal,
        expiresAt: new Date('2026-10-25T22:15:00.000Z'),
      } as unknown as PendingAction;
    },
  } as unknown as ActionsService;
  const tool = new ToolRegistry(createRefundTools(orders, actions)).get('request_refund')!;
  return { tool, proposals };
}

describe('request_refund', () => {
  it('proposes the refund of the whole refundable amount, without refunding', async () => {
    const { tool, proposals } = setup();

    const result = await tool.execute({ orderId: 'ord_1001', reason: 'Pedido atrasado' }, ana);

    expect(proposals).toEqual([
      {
        conversationId: 'conv-1',
        customerId: 'cust_001',
        orderId: 'ord_1001',
        amountCents: 18990,
        reason: 'Pedido atrasado',
      },
    ]);
    expect(result).toMatchObject({
      ok: true,
      data: { actionId: 'action-1', amount: 'R$ 189,90', status: 'awaiting_customer_approval' },
    });
  });

  it('proposes a partial refund when the amount is given', async () => {
    const { tool, proposals } = setup();

    await tool.execute({ orderId: 'ord_1001', reason: 'Item faltando', amountCents: 5000 }, ana);

    expect(proposals[0].amountCents).toBe(5000);
  });

  it('denies an order of another customer with the same answer as not found', async () => {
    const { tool, proposals } = setup({ order: { id: 'ord_2001', customerId: 'cust_002' } });

    const result = await tool.execute({ orderId: 'ord_2001', reason: 'x' }, ana);

    expect(result).toMatchObject({ ok: false, code: 'order_not_found', outcome: 'denied' });
    expect(proposals).toHaveLength(0);
  });

  it('refuses a payment that was already refunded', async () => {
    const { tool, proposals } = setup({ payment: { status: 'refunded', refundedAmountCents: 18990 } });

    const result = await tool.execute({ orderId: 'ord_1001', reason: 'x' }, ana);

    expect(result).toMatchObject({ ok: false, code: 'payment_not_refundable' });
    expect(proposals).toHaveLength(0);
  });

  it('refuses an amount above what can still be refunded', async () => {
    const { tool, proposals } = setup({
      payment: { status: 'partially_refunded', refundedAmountCents: 10000 },
    });

    const result = await tool.execute({ orderId: 'ord_1001', reason: 'x', amountCents: 10000 }, ana);

    expect(result).toMatchObject({
      ok: false,
      code: 'amount_exceeds_refundable',
      message: 'O valor máximo que ainda pode ser estornado é R$ 89,90.',
    });
    expect(proposals).toHaveLength(0);
  });

  it('reports a missing order and an unavailable orders service', async () => {
    const missing = setup({
      getOrder: async () => {
        throw new OrdersApiError('not_found', '404');
      },
    });
    const down = setup({
      getOrder: async () => {
        throw new OrdersApiError('unavailable', '503');
      },
    });

    await expect(missing.tool.execute({ orderId: 'ord_9999', reason: 'x' }, ana)).resolves.toMatchObject({
      code: 'order_not_found',
      outcome: 'error',
    });
    await expect(down.tool.execute({ orderId: 'ord_1001', reason: 'x' }, ana)).resolves.toMatchObject({
      code: 'orders_unavailable',
    });
  });

  it('rejects an empty reason and a non-positive amount before running', () => {
    const { tool } = setup();

    expect(tool.input.safeParse({ orderId: 'ord_1001', reason: '  ' }).success).toBe(false);
    expect(tool.input.safeParse({ orderId: 'ord_1001', reason: 'x', amountCents: 0 }).success).toBe(false);
  });
});
