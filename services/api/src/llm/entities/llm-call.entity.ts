import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Uma linha por chamada à LLM: base para acompanhar custo, latência e erros. */
@Entity({ name: 'llm_calls' })
export class LlmCall {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', length: 20 })
  provider: string;

  @Column({ type: 'varchar', length: 100 })
  model: string;

  @Column({ name: 'prompt_version', type: 'varchar', length: 50 })
  promptVersion: string;

  @Column({ name: 'input_tokens', type: 'integer', nullable: true })
  inputTokens: number | null;

  @Column({ name: 'output_tokens', type: 'integer', nullable: true })
  outputTokens: number | null;

  @Column({ name: 'latency_ms', type: 'integer' })
  latencyMs: number;

  @Column({ name: 'stop_reason', type: 'varchar', length: 20, nullable: true })
  stopReason: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
