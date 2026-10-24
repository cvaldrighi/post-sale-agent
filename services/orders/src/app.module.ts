import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { buildDataSourceOptions } from './database/database.options';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
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
  ],
})
export class AppModule {}
