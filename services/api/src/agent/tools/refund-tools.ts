import { z } from 'zod';
import type { ActionsService } from '../../actions/actions.service';
import { formatBrl } from '../../common/money';
import { OrdersApiError, type OrdersClient } from '../../orders-client/orders.client';
import { defineTool, type AgentTool, type ToolResult } from './tool';

const REFUNDABLE_STATUSES = new Set(['confirmed', 'partially_refunded']);

// Mesmas mensagens das ferramentas de consulta, para o cliente não perceber diferença
const NOT_FOUND = 'Pedido não encontrado para este cliente.';
const UNAVAILABLE = 'O sistema de pedidos está indisponível no momento. Tente novamente em alguns minutos.';

export function createRefundTools(orders: OrdersClient, actions: ActionsService): AgentTool[] {
  return [
    defineTool({
      name: 'request_refund',
      description:
        'Propõe o estorno do pagamento de um pedido do cliente. NÃO faz o estorno: cria uma proposta ' +
        'que o próprio cliente precisa aprovar. Use quando o cliente pedir o estorno ou o dinheiro de ' +
        'volta de um pedido. Sem amountCents, propõe o estorno de todo o valor que ainda pode ser estornado.',
      input: z.object({
        orderId: z.string().min(1).describe('Identificador do pedido, por exemplo "ord_1001"'),
        reason: z.string().trim().min(1).max(500).describe('Motivo informado pelo cliente'),
        amountCents: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Valor em centavos, só para estorno parcial (ex.: 5000 para R$ 50,00)'),
      }),
      async execute({ orderId, reason, amountCents }, context): Promise<ToolResult> {
        try {
          // 1. O pedido é do cliente do token? (mesma regra e mesma resposta do get_order)
          const order = await orders.getOrder(orderId, context.correlationId);
          if (order.customerId !== context.customerId) {
            return { ok: false, code: 'order_not_found', message: NOT_FOUND, outcome: 'denied' };
          }

          // 2. O pagamento pode ser estornado, e quanto?
          const payment = await orders.getPayment(orderId, context.correlationId);
          const refundable = payment.amountCents - payment.refundedAmountCents;
          if (!REFUNDABLE_STATUSES.has(payment.status) || refundable <= 0) {
            return {
              ok: false,
              code: 'payment_not_refundable',
              message:
                'O pagamento deste pedido não pode ser estornado (não foi confirmado ou já foi estornado).',
              outcome: 'error',
            };
          }
          const amount = amountCents ?? refundable;
          if (amount > refundable) {
            return {
              ok: false,
              code: 'amount_exceeds_refundable',
              message: `O valor máximo que ainda pode ser estornado é ${formatBrl(refundable)}.`,
              outcome: 'error',
            };
          }

          // 3. Só propõe. Quem executa é POST /actions/{id}/approve, que a LLM não tem como chamar.
          const action = await actions.proposeRefund({
            conversationId: context.conversationId,
            customerId: context.customerId,
            orderId,
            amountCents: amount,
            reason,
          });

          return {
            ok: true,
            data: {
              actionId: action.id,
              orderId,
              amount: formatBrl(action.amountCents),
              amountCents: action.amountCents,
              status: 'awaiting_customer_approval',
              expiresAt: action.expiresAt.toISOString(),
              instructions:
                'O estorno ainda NÃO foi feito. Diga ao cliente o valor e o pedido e que ele precisa ' +
                'aprovar a solicitação para o estorno acontecer.',
            },
          };
        } catch (error) {
          if (error instanceof OrdersApiError && error.kind === 'not_found') {
            return { ok: false, code: 'order_not_found', message: NOT_FOUND, outcome: 'error' };
          }
          if (error instanceof OrdersApiError) {
            return { ok: false, code: 'orders_unavailable', message: UNAVAILABLE, outcome: 'error' };
          }
          throw error; // erro inesperado: o executor do agente trata
        }
      },
    }),
  ];
}
