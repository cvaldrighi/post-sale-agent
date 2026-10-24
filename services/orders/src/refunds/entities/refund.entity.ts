import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const REFUND_STATUSES = ['processing', 'completed'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

@Entity({ name: 'refunds' })
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id', type: 'varchar', length: 32 })
  orderId: string;

  @Column({ name: 'payment_id', type: 'varchar', length: 32 })
  paymentId: string;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', length: 20 })
  status: RefundStatus;

  /** Chave enviada pelo cliente no header Idempotency-Key (única). */
  @Column({ name: 'idempotency_key', type: 'varchar', length: 64, unique: true })
  idempotencyKey: string;

  /** SHA-256 do corpo da requisição, para detectar a mesma chave com outro corpo. */
  @Column({ name: 'request_hash', type: 'char', length: 64 })
  requestHash: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
