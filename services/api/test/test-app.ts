import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { LLM_PROVIDER } from '../src/llm/llm.types';
import { FakeLlmProvider } from './fake-llm.provider';

export interface TestContext {
  app: INestApplication;
  llm: FakeLlmProvider;
}

/** Sobe a aplicação inteira, com o provedor de LLM trocado por um falso. */
export async function createTestApp(): Promise<TestContext> {
  const llm = new FakeLlmProvider();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LLM_PROVIDER)
    .useValue(llm)
    .compile();

  const app = moduleRef.createNestApplication({ bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.init();
  return { app, llm };
}

export async function resetDatabase(app: INestApplication): Promise<void> {
  await app
    .get(DataSource)
    .query('TRUNCATE app.llm_calls, app.messages, app.conversations RESTART IDENTITY CASCADE');
}

export async function tokenFor(app: INestApplication, customerId: string): Promise<string> {
  const res = await request(app.getHttpServer()).post('/auth/token').send({ customerId });
  return res.body.accessToken as string;
}

/** Token assinado com o segredo certo, mas já expirado. */
export function expiredTokenFor(customerId: string): string {
  return new JwtService({ secret: process.env.JWT_SECRET }).sign({
    sub: customerId,
    exp: Math.floor(Date.now() / 1000) - 60,
  });
}
