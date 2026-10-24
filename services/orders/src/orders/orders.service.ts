import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProblemException } from '../common/problem';
import { Order } from './entities/order.entity';
import { Payment } from './entities/payment.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
  ) {}

  /** Pedidos do cliente, do mais recente para o mais antigo. Cliente desconhecido: lista vazia. */
  listByCustomer(customerId: string): Promise<Order[]> {
    return this.orders.find({ where: { customerId }, order: { createdAt: 'DESC' } });
  }

  async getById(orderId: string): Promise<Order> {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: { customer: true },
    });
    if (!order) throw orderNotFound(orderId);
    return order;
  }

  async getPayment(orderId: string): Promise<Payment> {
    const payment = await this.payments.findOne({ where: { orderId } });
    if (!payment) throw orderNotFound(orderId);
    return payment;
  }
}

export function orderNotFound(orderId: string): ProblemException {
  return new ProblemException(
    'order_not_found',
    HttpStatus.NOT_FOUND,
    `Pedido ${orderId} não encontrado`,
  );
}
