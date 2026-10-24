import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './config/env.validation';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  setupSwagger(app);

  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
