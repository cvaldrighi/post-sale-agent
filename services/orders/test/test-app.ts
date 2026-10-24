import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { SeedSampleData1761300000001 } from '../src/database/migrations/1761300000001-SeedSampleData';

export const API_KEY = 'test-api-key-0123456789';

/** Sobe a aplicação inteira (com guard, filtro, interceptor e banco), como em produção. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.init();
  return app;
}

/** Volta os dados de exemplo ao estado inicial, reaproveitando a migration de seed. */
export async function resetSampleData(app: INestApplication): Promise<void> {
  const queryRunner = app.get(DataSource).createQueryRunner();
  try {
    const seed = new SeedSampleData1761300000001();
    await seed.down(queryRunner);
    await seed.up(queryRunner);
  } finally {
    await queryRunner.release();
  }
}
