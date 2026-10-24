import { Controller, Get, Param } from '@nestjs/common';
import { toOrderResponse, toOrderSummary, toPaymentResponse } from './orders.mapper';
import { OrdersService } from './orders.service';

@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('customers/:customerId/orders')
  async listCustomerOrders(@Param('customerId') customerId: string) {
    const orders = await this.ordersService.listByCustomer(customerId);
    return { data: orders.map(toOrderSummary) };
  }

  @Get('orders/:orderId')
  async getOrder(@Param('orderId') orderId: string) {
    return toOrderResponse(await this.ordersService.getById(orderId));
  }

  @Get('orders/:orderId/payment')
  async getOrderPayment(@Param('orderId') orderId: string) {
    return toPaymentResponse(await this.ordersService.getPayment(orderId));
  }
}
