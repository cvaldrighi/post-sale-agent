import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import type { EnvironmentVariables } from '../config/env.validation';
import { OrdersClient } from './orders.client';

/** Cliente do orders, compartilhado pelo agente (consultas) e pelas ações (estornos). */
@Module({
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
  ],
  exports: [OrdersClient],
})
export class OrdersClientModule {}
