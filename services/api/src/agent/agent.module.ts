import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PinoLogger } from 'nestjs-pino';
import type { EnvironmentVariables } from '../config/env.validation';
import { LlmModule } from '../llm/llm.module';
import { OrdersClient } from '../orders-client/orders.client';
import { OrdersClientModule } from '../orders-client/orders-client.module';
import { RetrievalClient } from '../retrieval-client/retrieval.client';
import { AgentService } from './agent.service';
import { ToolCall } from './entities/tool-call.entity';
import { createOrderTools } from './tools/order-tools';
import { createPolicyTools } from './tools/policy-tools';
import { ToolRegistry } from './tools/tool';

@Module({
  imports: [TypeOrmModule.forFeature([ToolCall]), LlmModule, OrdersClientModule],
  providers: [
    {
      provide: RetrievalClient,
      inject: [ConfigService, PinoLogger],
      useFactory: (config: ConfigService<EnvironmentVariables, true>, logger: PinoLogger) => {
        logger.setContext(RetrievalClient.name);
        return new RetrievalClient({
          baseUrl: config.get('RETRIEVAL_BASE_URL', { infer: true }),
          apiKey: config.get('RETRIEVAL_API_KEY', { infer: true }),
          timeoutMs: config.get('RETRIEVAL_TIMEOUT_MS', { infer: true }),
          onRetry: (details) => logger.warn(details, 'Retrying retrieval request'),
        });
      },
    },
    {
      provide: ToolRegistry,
      inject: [OrdersClient, RetrievalClient],
      useFactory: (orders: OrdersClient, retrieval: RetrievalClient) =>
        new ToolRegistry([...createOrderTools(orders), ...createPolicyTools(retrieval)]),
    },
    AgentService,
  ],
  exports: [AgentService],
})
export class AgentModule {}
