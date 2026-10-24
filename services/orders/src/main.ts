import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/env.validation';

async function bootstrap() {
  // bufferLogs: guarda os logs da inicialização até o logger JSON estar pronto
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks(); // fecha as conexões com o banco ao receber SIGTERM (ex.: docker stop)

  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
