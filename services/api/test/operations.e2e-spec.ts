import request from 'supertest';
import { createTestApp, type TestContext } from './test-app';

describe('API operations (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /health answers ok without a token', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('echoes x-correlation-id', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/health').set('x-correlation-id', 'abc-123');

    expect(res.headers['x-correlation-id']).toBe('abc-123');
  });

  it('answers errors with problem+json', async () => {
    const res = await request(ctx.app.getHttpServer()).post('/conversations');

    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ status: 401, code: 'unauthorized' });
  });
});
