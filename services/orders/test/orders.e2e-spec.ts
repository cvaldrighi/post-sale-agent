import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { API_KEY, createTestApp, resetSampleData } from './test-app';

describe('Order queries (e2e)', () => {
  let app: INestApplication;
  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('x-api-key', API_KEY);

  beforeAll(async () => {
    app = await createTestApp();
    await resetSampleData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /customers/:customerId/orders', () => {
    it('lists only the customer orders, newest first', async () => {
      const res = await get('/customers/cust_001/orders');

      expect(res.status).toBe(200);
      expect(res.body.data.map((o: { id: string }) => o.id)).toEqual([
        'ord_1003',
        'ord_1001',
        'ord_1002',
      ]);
      expect(res).toMatchContract();
    });

    it('returns an empty list for an unknown customer', async () => {
      const res = await get('/customers/cust_999/orders');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [] });
      expect(res).toMatchContract();
    });
  });

  describe('GET /orders/:orderId', () => {
    it('returns the order with its customer and money in cents', async () => {
      const res = await get('/orders/ord_1001');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: 'ord_1001',
        customerId: 'cust_001',
        status: 'delayed',
        totalCents: 18990,
        currency: 'BRL',
        deliveredAt: null,
      });
      expect(res).toMatchContract();
    });

    it('answers 404 order_not_found for an unknown order', async () => {
      const res = await get('/orders/ord_9999');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('order_not_found');
      expect(res).toMatchContract();
    });
  });

  describe('GET /orders/:orderId/payment', () => {
    it('returns only the last 4 card digits for card payments', async () => {
      const res = await get('/orders/ord_1002/payment');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ method: 'credit_card', cardLast4: '4242' });
      expect(res).toMatchContract(); // o contrato proíbe campos extras
    });

    it('returns cardLast4 null for Pix payments', async () => {
      const res = await get('/orders/ord_1001/payment');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ method: 'pix', cardLast4: null, status: 'confirmed' });
      expect(res).toMatchContract();
    });

    it('answers 404 order_not_found for an unknown order', async () => {
      const res = await get('/orders/ord_9999/payment');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('order_not_found');
      expect(res).toMatchContract();
    });
  });
});
