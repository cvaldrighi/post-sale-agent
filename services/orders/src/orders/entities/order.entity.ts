import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryColumn } from 'typeorm';
import { Customer } from './customer.entity';
import { Payment } from './payment.entity';

export const ORDER_STATUSES = [
  'awaiting_payment',
  'paid',
  'shipped',
  'delayed',
  'delivered',
  'canceled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
}

@Entity({ name: 'orders' })
export class Order {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  id: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 32 })
  customerId: string;

  @ManyToOne(() => Customer, { nullable: false })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ type: 'varchar', length: 20 })
  status: OrderStatus;

  /** Itens em jsonb: são só leitura nesta PoC, não precisam de tabela própria. */
  @Column({ type: 'jsonb' })
  items: OrderItem[];

  @Column({ name: 'total_cents', type: 'integer' })
  totalCents: number;

  @Column({ type: 'char', length: 3 })
  currency: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'estimated_delivery_date', type: 'date' })
  estimatedDeliveryDate: string;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @OneToOne(() => Payment, (payment) => payment.order)
  payment: Payment;
}
