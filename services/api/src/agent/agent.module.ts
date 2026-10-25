import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import type { EnvironmentVariables } from '../config/env.validation';
import { LlmModule } from '../llm/llm.module';
import { OrdersClient } from '../orders-client/orders.client';
import { AgentService } from './agent.service';
import { ToolCall } from './entities/tool-call.entity';
import { createOrderTools } from './tools/order-tools';
import { ToolRegistry } from './tools/tool';

@Module({
  imports: [TypeOrmModule.forFeature([ToolCall]), LlmModule],
  providers: [
    {
      provide: OrdersClient,
      inject: [ConfigService, PinoLogger],
      useFactory: (config: ConfigService<EnvironmentVariables, true>, logger: PinoLogger) => {
        logger.setContext(OrdersClient.name);
        return new OrdersClient({
          baseUrl: config.get('ORDERS_BASE_URL', { infer: true }),
          apiKey: config.get('ORDERS_API_KEY', { infer: true }),
          timeoutMs: config.get('ORDERS_TIMEOUT_MS', { infer: true }),
          onRetry: (details) => logger.warn(details, 'Retrying orders request'),
        });
      },
    },
    {
      provide: ToolRegistry,
      inject: [OrdersClient],
      useFactory: (orders: OrdersClient) => new ToolRegistry(createOrderTools(orders)),
    },
    AgentService,
  ],
  exports: [AgentService],
})
export class AgentModule {}
