import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const MESSAGE_ROLES = ['user', 'assistant'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

@Entity({ name: 'messages' })
export class Message {
  /**
   * Inteiro sequencial (identity): define a ordem das mensagens sem depender do relógio.
   * Duas mensagens gravadas no mesmo milissegundo ainda ficam na ordem certa.
   * O TypeORM devolve bigint como string.
   */
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'BY DEFAULT' })
  id: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ type: 'varchar', length: 16 })
  role: MessageRole;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
