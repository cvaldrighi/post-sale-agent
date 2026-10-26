import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const ACTION_STATUSES = ['pending', 'executing', 'executed', 'failed', 'rejected'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export type ActionType = 'refund';

/**
 * Uma ação proposta pelo agente que só executa com a aprovação do cliente.
 *
 *   pending → executing → executed | failed      (aprovada)
 *   pending → rejected                           (recusada)
 *
 * O id também é a Idempotency-Key no orders: aprovar de novo nunca cria um segundo estorno.
 */
@Entity({ name: 'pending_actions' })
export class PendingAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  /** Dono da ação, vindo do token. Aprovar exige o mesmo cliente. */
  @Column({ name: 'customer_id', type: 'varchar', length: 32 })
  customerId: string;

  @Column({ type: 'varchar', length: 16 })
  type: ActionType;

  // O que será executado fica fixado na proposta: a aprovação não aceita outros valores
  @Column({ name: 'order_id', type: 'varchar', length: 64 })
  orderId: string;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents: number;

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: ActionStatus;

  /** Resposta do orders quando a execução deu certo (o estorno criado). */
  @Column({ type: 'jsonb', nullable: true })
  result: unknown;

  @Column({ name: 'error_code', type: 'varchar', length: 64, nullable: true })
  errorCode: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;
}
