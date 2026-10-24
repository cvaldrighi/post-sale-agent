import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'conversations' })
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Dono da conversa, vindo do token. Toda consulta filtra por ele. */
  @Column({ name: 'customer_id', type: 'varchar', length: 32 })
  customerId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
