import type { Order } from './entities/order.entity';
import type { Payment } from './entities/payment.entity';

/**
 * Converte as entidades do banco para o formato do contrato (contracts/orders.yaml).
 * Separar as duas coisas evita vazar colunas internas: só sai o que está listado aqui.
 */

export function toOrderSummary(order: Order) {
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
  };
}

export function toOrderResponse(order: Order) {
  return {
    id: order.id,
    customerId: order.customerId,
    customer: { name: order.customer.name, document: order.customer.document },
    status: order.status,
    items: order.items,
    totalCents: order.totalCents,
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    estimatedDeliveryDate: order.estimatedDeliveryDate,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
  };
}

export function toPaymentResponse(payment: Payment) {
  return {
    id: payment.id,
    orderId: payment.orderId,
    method: payment.method,
    status: payment.status,
    amountCents: payment.amountCents,
    refundedAmountCents: payment.refundedAmountCents,
    currency: payment.currency,
    paidAt: payment.paidAt?.toISOString() ?? null,
    cardLast4: payment.cardLast4,
  };
}
