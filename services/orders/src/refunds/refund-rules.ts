import { HttpStatus } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ProblemException } from '../common/problem';
import type { Payment, PaymentStatus } from '../orders/entities/payment.entity';
import type { RefundStatus } from './entities/refund.entity';
import type { CreateRefundDto } from './dto/create-refund.dto';

const REFUNDABLE_STATUSES: PaymentStatus[] = ['confirmed', 'partially_refunded'];

export interface RefundDecision {
  refundStatus: RefundStatus;
  paymentStatus: PaymentStatus;
  refundedAmountCents: number;
}

/**
 * Regras de negócio do estorno, sem banco nem HTTP: dado o pagamento e o valor pedido,
 * decide o resultado ou lança o erro do contrato.
 */
export function decideRefund(payment: Payment, amountCents: number): RefundDecision {
  if (!REFUNDABLE_STATUSES.includes(payment.status)) {
    throw new ProblemException(
      'payment_not_refundable',
      HttpStatus.CONFLICT,
      `Pagamento com status ${payment.status} não pode ser estornado`,
    );
  }

  const refundable = payment.amountCents - payment.refundedAmountCents;
  if (amountCents > refundable) {
    throw new ProblemException(
      'amount_exceeds_refundable',
      HttpStatus.UNPROCESSABLE_ENTITY,
      `Valor máximo estornável: ${refundable} centavos`,
    );
  }

  const refundedAmountCents = payment.refundedAmountCents + amountCents;
  return {
    // Pix devolve na hora; cartão depende da operadora, então fica "processing"
    refundStatus: payment.method === 'pix' ? 'completed' : 'processing',
    paymentStatus: refundedAmountCents === payment.amountCents ? 'refunded' : 'partially_refunded',
    refundedAmountCents,
  };
}

/** Hash do corpo da requisição, com os campos sempre na mesma ordem. */
export function requestHash(body: CreateRefundDto): string {
  const canonical = JSON.stringify([body.orderId, body.amountCents, body.reason]);
  return createHash('sha256').update(canonical).digest('hex');
}
