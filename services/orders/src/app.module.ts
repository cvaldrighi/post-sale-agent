import { HttpStatus, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { ApiKeyGuard } from './common/api-key.guard';
import { buildLoggerParams } from './common/logging';
import { ProblemException } from './common/problem';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { SimulationInterceptor } from './common/simulation.interceptor';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { buildDataSourceOptions } from './database/database.options';
import { HealthController } from './health/health.controller';
import { OrdersModule } from './orders/orders.module';
import { RefundsModule } from './refunds/refunds.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        buildLoggerParams(config.get('LOG_LEVEL', { infer: true })),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        ...buildDataSourceOptions({
          host: config.get('DATABASE_HOST', { infer: true }),
          port: config.get('DATABASE_PORT', { infer: true }),
          name: config.get('DATABASE_NAME', { infer: true }),
          user: config.get('DATABASE_USER', { infer: true }),
          password: config.get('DATABASE_PASSWORD', { infer: true }),
        }),
        migrationsRun: true, // aplica as migrations pendentes ao iniciar
      }),
    }),
    OrdersModule,
    RefundsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Registrados aqui (e não no main.ts) para valerem também nos testes E2E
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_INTERCEPTOR, useClass: SimulationInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // remove campos que não estão no DTO
        forbidNonWhitelisted: true, // e recusa a requisição se vierem campos extras
        transform: true,
        exceptionFactory: (errors) =>
          new ProblemException(
            'validation_error',
            HttpStatus.BAD_REQUEST,
            errors.flatMap((error) => Object.values(error.constraints ?? {})).join('; '),
          ),
      }),
    },
  ],
})
export class AppModule {}
