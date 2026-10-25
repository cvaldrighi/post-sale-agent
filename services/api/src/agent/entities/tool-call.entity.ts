import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ToolOutcome = 'success' | 'error' | 'denied';

/** Uma linha por execução de ferramenta: junto com llm_calls, reconstrói cada passo do agente. */
@Entity({ name: 'tool_calls' })
export class ToolCall {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId: string | null;

  @Column({ name: 'tool_name', type: 'varchar', length: 64 })
  toolName: string;

  @Column({ type: 'jsonb' })
  input: unknown;

  @Column({ type: 'varchar', length: 16 })
  outcome: ToolOutcome;

  @Column({ name: 'error_code', type: 'varchar', length: 64, nullable: true })
  errorCode: string | null;

  @Column({ name: 'latency_ms', type: 'integer' })
  latencyMs: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
