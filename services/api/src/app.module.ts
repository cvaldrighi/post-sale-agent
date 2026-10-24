import { HttpStatus, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { buildLoggerParams } from './common/logging';
import { ProblemException } from './common/problem';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { ConversationsModule } from './conversations/conversations.module';
import { buildDataSourceOptions } from './database/database.options';
import { HealthController } from './health/health.controller';

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
        migrationsRun: true,
      }),
    }),
    AuthModule,
    ConversationsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
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
