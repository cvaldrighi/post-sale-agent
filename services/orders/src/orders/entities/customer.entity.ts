import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'customers' })
export class Customer {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ type: 'text' })
  name: string;

  /** CPF completo. Dado pessoal: quem consome a API deve mascarar antes de expor. */
  @Column({ type: 'varchar', length: 14 })
  document: string;
}
