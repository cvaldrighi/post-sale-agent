import { z } from 'zod';
import { formatBrl } from '../../common/money';
import { OrdersApiError, type OrdersClient } from '../../orders-client/orders.client';
import type { Order } from '../../orders-client/orders.schemas';
import { defineTool, type AgentTool, type ToolContext, type ToolResult } from './tool';

export { formatBrl };

const ORDER_STATUS: Record<Order['status'], string> = {
  awaiting_payment: 'aguardando pagamento',
  paid: 'pago, aguardando envio',
  shipped: 'enviado',
  delayed: 'atrasado',
  delivered: 'entregue',
  canceled: 'cancelado',
};

const PAYMENT_STATUS: Record<string, string> = {
  pending: 'pendente',
  confirmed: 'confirmado',
  failed: 'recusado',
  partially_refunded: 'estornado parcialmente',
  refunded: 'estornado',
};

const PAYMENT_METHOD: Record<string, string> = { pix: 'Pix', credit_card: 'cartão de crédito' };

const NOT_FOUND = 'Pedido não encontrado para este cliente.';
const UNAVAILABLE = 'O sistema de pedidos está indisponível no momento. Tente novamente em alguns minutos.';

const orderIdInput = z.object({
  orderId: z.string().min(1).describe('Identificador do pedido, por exemplo "ord_1001"'),
});

export function createOrderTools(orders: OrdersClient): AgentTool[] {
  /**
   * Busca o pedido e confere se é do cliente do contexto. Pedido de outro cliente tem a mesma
   * resposta de um inexistente, para não revelar que existe.
   */
  async function ownedOrder(orderId: string, context: ToolContext): Promise<Order | ToolResult> {
    try {
      const order = await orders.getOrder(orderId, context.correlationId);
      if (order.customerId !== context.customerId) {
        return { ok: false, code: 'order_not_found', message: NOT_FOUND, outcome: 'denied' };
      }
      return order;
    } catch (error) {
      return toFailure(error);
    }
  }

  return [
    defineTool({
      name: 'list_my_orders',
      description:
        'Lista os pedidos do cliente, do mais recente para o mais antigo. Use quando o cliente não ' +
        'informar o número do pedido ou perguntar quais pedidos tem.',
      input: z.object({}),
      async execute(_input, context) {
        try {
          const list = await orders.listCustomerOrders(context.customerId, context.correlationId);
          return {
            ok: true,
            data: {
              orders: list.map((order) => ({
                orderId: order.id,
                status: order.status,
                statusDescription: ORDER_STATUS[order.status],
                total: formatBrl(order.totalCents),
                totalCents: order.totalCents,
                orderedAt: order.createdAt,
              })),
            },
          };
        } catch (error) {
          return toFailure(error);
        }
      },
    }),

    defineTool({
      name: 'get_order',
      description:
        'Consulta um pedido do cliente: status, itens, valor total, data do pedido, previsão e data ' +
        'de entrega.',
      input: orderIdInput,
      async execute({ orderId }, context) {
        const order = await ownedOrder(orderId, context);
        if ('ok' in order) return order;
        return {
          ok: true,
          data: {
            orderId: order.id,
            status: order.status,
            statusDescription: ORDER_STATUS[order.status],
            items: order.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: formatBrl(item.unitPriceCents),
            })),
            total: formatBrl(order.totalCents),
            totalCents: order.totalCents,
            orderedAt: order.createdAt,
            estimatedDeliveryDate: order.estimatedDeliveryDate,
            deliveredAt: order.deliveredAt,
            // Sem os dados pessoais do cliente (nome, CPF): não são necessários para responder
          },
        };
      },
    }),

    defineTool({
      name: 'get_payment',
      description:
        'Consulta o pagamento de um pedido do cliente: método (Pix ou cartão), status, valor pago e ' +
        'valor já estornado.',
      input: orderIdInput,
      async execute({ orderId }, context) {
        const order = await ownedOrder(orderId, context); // confere o dono antes do pagamento
        if ('ok' in order) return order;
        try {
          const payment = await orders.getPayment(orderId, context.correlationId);
          return {
            ok: true,
            data: {
              orderId: payment.orderId,
              method: payment.method,
              methodDescription: PAYMENT_METHOD[payment.method],
              status: payment.status,
              statusDescription: PAYMENT_STATUS[payment.status],
              amount: formatBrl(payment.amountCents),
              amountCents: payment.amountCents,
              refundedAmount: formatBrl(payment.refundedAmountCents),
              refundedAmountCents: payment.refundedAmountCents,
              paidAt: payment.paidAt,
              cardLast4: payment.cardLast4,
            },
          };
        } catch (error) {
          return toFailure(error);
        }
      },
    }),
  ];
}

function toFailure(error: unknown): ToolResult {
  if (error instanceof OrdersApiError && error.kind === 'not_found') {
    return { ok: false, code: 'order_not_found', message: NOT_FOUND, outcome: 'error' };
  }
  if (error instanceof OrdersApiError) {
    return { ok: false, code: 'orders_unavailable', message: UNAVAILABLE, outcome: 'error' };
  }
  throw error; // erro inesperado: o executor do agente trata
}
