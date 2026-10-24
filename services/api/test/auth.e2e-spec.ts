import request from 'supertest';
import { createTestApp, expiredTokenFor, type TestContext, tokenFor } from './test-app';

describe('Customer authentication (e2e)', () => {
  let ctx: TestContext;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('POST /auth/token', () => {
    it('issues a Bearer token for the customer', async () => {
      const res = await request(server()).post('/auth/token').send({ customerId: 'cust_001' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 3600 });
      const payload = JSON.parse(
        Buffer.from(res.body.accessToken.split('.')[1], 'base64url').toString(),
      );
      expect(payload.sub).toBe('cust_001');
    });

    it('rejects an invalid customerId', async () => {
      const res = await request(server()).post('/auth/token').send({ customerId: 'admin' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('validation_error');
    });
  });

  describe('protected routes', () => {
    it('rejects a request without a token', async () => {
      const res = await request(server()).post('/conversations');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('unauthorized');
    });

    it('rejects a token with a tampered signature', async () => {
      const token = await tokenFor(ctx.app, 'cust_001');
      const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');

      const res = await request(server()).post('/conversations').set('Authorization', `Bearer ${tampered}`);

      expect(res.status).toBe(401);
    });

    it('rejects an expired token', async () => {
      const res = await request(server())
        .post('/conversations')
        .set('Authorization', `Bearer ${expiredTokenFor('cust_001')}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('unauthorized');
    });

    it('accepts a valid token', async () => {
      const token = await tokenFor(ctx.app, 'cust_001');

      const res = await request(server()).post('/conversations').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
    });
  });
});
