import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API_KEY, createTestApp } from './test-app';

describe('Orders service operations (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('answers ok without an API key', async () => {
      const res = await request(app.getHttpServer()).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
      expect(res).toMatchContract();
    });
  });

  describe('API key', () => {
    it('rejects a request without x-api-key', async () => {
      const res = await request(app.getHttpServer()).get('/orders/ord_1001');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('unauthorized');
      expect(res).toMatchContract();
    });

    it('rejects a wrong x-api-key', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/ord_1001')
        .set('x-api-key', 'wrong-key-0123456789');

      expect(res.status).toBe(401);
      expect(res).toMatchContract();
    });

    it('accepts the configured x-api-key', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/ord_1001')
        .set('x-api-key', API_KEY);

      expect(res.status).toBe(200);
    });
  });

  describe('Correlation ID', () => {
    it('echoes the received x-correlation-id', async () => {
      const res = await request(app.getHttpServer())
        .get('/health')
        .set('x-correlation-id', 'abc-123');

      expect(res.headers['x-correlation-id']).toBe('abc-123');
    });

    it('generates one when it is missing', async () => {
      const res = await request(app.getHttpServer()).get('/health');

      expect(res.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('Error format', () => {
    it('answers unknown routes with problem+json', async () => {
      const res = await request(app.getHttpServer()).get('/nope').set('x-api-key', API_KEY);

      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 404, code: 'not_found' });
    });
  });

  describe('Failure simulation (x-simulate)', () => {
    it('answers 503 simulated_failure with x-simulate: error', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders/ord_1001')
        .set('x-api-key', API_KEY)
        .set('x-simulate', 'error');

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('simulated_failure');
      expect(res).toMatchContract();
    });

    it('answers normally after the configured delay with x-simulate: slow', async () => {
      const started = Date.now();
      const res = await request(app.getHttpServer())
        .get('/orders/ord_1001')
        .set('x-api-key', API_KEY)
        .set('x-simulate', 'slow');

      expect(res.status).toBe(200);
      expect(Date.now() - started).toBeGreaterThanOrEqual(300);
      expect(res).toMatchContract();
    });
  });
});
