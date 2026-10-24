import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Order } from './order.entity';

export const PAYMENT_METHODS = ['pix', 'credit_card'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'confirmed',
  'failed',
  'partially_refunded',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

@Entity({ name: 'payments' })
export class Payment {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ name: 'order_id', type: 'varchar', length: 32, unique: true })
  orderId: string;

  @OneToOne(() => Order, (order) => order.payment, { nullable: false })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'varchar', length: 20 })
  method: PaymentMethod;

  @Column({ type: 'varchar', length: 20 })
  status: PaymentStatus;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents: number;

  @Column({ name: 'refunded_amount_cents', type: 'integer', default: 0 })
  refundedAmountCents: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  /** Só os 4 últimos dígitos. O número completo do cartão nunca é armazenado. */
  @Column({ name: 'card_last4', type: 'char', length: 4, nullable: true })
  cardLast4: string | null;
}
