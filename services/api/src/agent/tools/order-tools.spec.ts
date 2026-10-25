import { OrdersApiError, type OrdersClient } from '../../orders-client/orders.client';
import { createOrderTools, formatBrl } from './order-tools';
import { ToolRegistry, type ToolContext } from './tool';

const ana: ToolContext = { conversationId: 'conv-1', customerId: 'cust_001', correlationId: 'corr-1' };

const order = {
  id: 'ord_1001',
  customerId: 'cust_001',
  customer: { name: 'Ana Souza', document: '123.456.789-09' },
  status: 'delayed' as const,
  items: [{ sku: 'FONE', name: 'Fone de ouvido', quantity: 1, unitPriceCents: 18990 }],
  totalCents: 18990,
  currency: 'BRL' as const,
  createdAt: '2026-10-10T13:00:00.000Z',
  estimatedDeliveryDate: '2026-10-17',
  deliveredAt: null,
};
const payment = {
  id: 'pay_1001',
  orderId: 'ord_1001',
  method: 'pix' as const,
  status: 'confirmed' as const,
  amountCents: 18990,
  refundedAmountCents: 0,
  currency: 'BRL' as const,
  paidAt: '2026-10-10T13:02:00.000Z',
  cardLast4: null,
};

function tools(client: Partial<OrdersClient>) {
  return new ToolRegistry(createOrderTools(client as OrdersClient));
}

describe('order tools', () => {
  it('formats cents as reais', () => {
    expect(formatBrl(18990)).toBe('R$ 189,90');
  });

  it('get_order returns the order of the customer, formatted and without the CPF', async () => {
    const result = await tools({ getOrder: async () => order }).get('get_order')!.execute({ orderId: 'ord_1001' }, ana);

    expect(result).toMatchObject({
      ok: true,
      data: { orderId: 'ord_1001', status: 'delayed', statusDescription: 'atrasado', total: 'R$ 189,90' },
    });
    expect(JSON.stringify(result)).not.toContain('123.456.789-09');
    expect(JSON.stringify(result)).not.toContain('Ana Souza');
  });

  it('get_order denies an order of another customer with the same answer as not found', async () => {
    const other = { ...order, id: 'ord_2001', customerId: 'cust_002' };

    const result = await tools({ getOrder: async () => other }).get('get_order')!.execute({ orderId: 'ord_2001' }, ana);

    expect(result).toEqual({
      ok: false,
      code: 'order_not_found',
      message: 'Pedido não encontrado para este cliente.',
      outcome: 'denied',
    });
  });

  it('get_order reports a missing order', async () => {
    const client = { getOrder: async () => Promise.reject(new OrdersApiError('not_found', '404')) };

    const result = await tools(client).get('get_order')!.execute({ orderId: 'ord_9999' }, ana);

    expect(result).toMatchObject({ ok: false, code: 'order_not_found', outcome: 'error' });
  });

  it('turns an unavailable orders service into a friendly error', async () => {
    const client = { getOrder: async () => Promise.reject(new OrdersApiError('unavailable', 'timeout')) };

    const result = await tools(client).get('get_order')!.execute({ orderId: 'ord_1001' }, ana);

    expect(result).toMatchObject({ ok: false, code: 'orders_unavailable' });
    expect(JSON.stringify(result)).not.toContain('timeout'); // sem detalhe técnico para a LLM
  });

  it('get_payment checks the owner before reading the payment', async () => {
    let paymentRead = false;
    const client = {
      getOrder: async () => ({ ...order, customerId: 'cust_002' }),
      getPayment: async () => ((paymentRead = true), payment),
    };

    const result = await tools(client).get('get_payment')!.execute({ orderId: 'ord_1001' }, ana);

    expect(result).toMatchObject({ ok: false, outcome: 'denied' });
    expect(paymentRead).toBe(false);
  });

  it('get_payment returns the payment with descriptions', async () => {
    const client = { getOrder: async () => order, getPayment: async () => payment };

    const result = await tools(client).get('get_payment')!.execute({ orderId: 'ord_1001' }, ana);

    expect(result).toMatchObject({
      ok: true,
      data: { methodDescription: 'Pix', statusDescription: 'confirmado', amount: 'R$ 189,90' },
    });
  });

  it('list_my_orders always uses the customer from the context', async () => {
    let askedFor = '';
    const client = {
      listCustomerOrders: async (customerId: string) => {
        askedFor = customerId;
        return [{ id: 'ord_1001', status: 'delayed' as const, totalCents: 18990, currency: 'BRL' as const, createdAt: order.createdAt }];
      },
    };

    const result = await tools(client).get('list_my_orders')!.execute({}, ana);

    expect(askedFor).toBe('cust_001');
    expect(result).toMatchObject({ ok: true, data: { orders: [{ orderId: 'ord_1001', total: 'R$ 189,90' }] } });
  });

  it('exposes JSON Schemas generated from the Zod input', () => {
    const definitions = tools({}).definitions();

    expect(definitions.map((d) => d.name)).toEqual(['list_my_orders', 'get_order', 'get_payment']);
    expect(definitions[1].inputSchema).toMatchObject({
      type: 'object',
      properties: { orderId: { type: 'string' } },
      required: ['orderId'],
    });
    expect(definitions[1].inputSchema).not.toHaveProperty('$schema');
  });
});
