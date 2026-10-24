import type { Payment } from '../orders/entities/payment.entity';
import { decideRefund, requestHash } from './refund-rules';

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay_1',
    orderId: 'ord_1',
    method: 'pix',
    status: 'confirmed',
    amountCents: 10000,
    refundedAmountCents: 0,
    currency: 'BRL',
    paidAt: new Date(),
    cardLast4: null,
    ...overrides,
  } as Payment;
}

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

describe('decideRefund', () => {
  it('completes a full Pix refund and marks the payment as refunded', () => {
    expect(decideRefund(payment(), 10000)).toEqual({
      refundStatus: 'completed',
      paymentStatus: 'refunded',
      refundedAmountCents: 10000,
    });
  });

  it('keeps a card refund processing and marks a partial refund', () => {
    expect(decideRefund(payment({ method: 'credit_card' }), 4000)).toEqual({
      refundStatus: 'processing',
      paymentStatus: 'partially_refunded',
      refundedAmountCents: 4000,
    });
  });

  it('allows refunding the rest of a partially refunded payment', () => {
    const decision = decideRefund(
      payment({ status: 'partially_refunded', refundedAmountCents: 4000 }),
      6000,
    );

    expect(decision.paymentStatus).toBe('refunded');
  });

  it.each(['pending', 'failed', 'refunded'] as const)('rejects a %s payment', (status) => {
    expect(errorCode(() => decideRefund(payment({ status }), 100))).toBe('payment_not_refundable');
  });

  it('rejects more than the refundable amount', () => {
    const partially = payment({ status: 'partially_refunded', refundedAmountCents: 4000 });

    expect(errorCode(() => decideRefund(partially, 6001))).toBe('amount_exceeds_refundable');
  });
});

describe('requestHash', () => {
  const body = { orderId: 'ord_1', amountCents: 100, reason: 'Atraso' };

  it('is the same for the same body', () => {
    expect(requestHash({ ...body })).toBe(requestHash({ ...body }));
  });

  it('changes when any field changes', () => {
    expect(requestHash({ ...body, amountCents: 101 })).not.toBe(requestHash(body));
  });
});
