import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { API_KEY, createTestApp, resetSampleData } from './test-app';

describe('POST /refunds (e2e)', () => {
  let app: INestApplication;

  const refund = (body: object, idempotencyKey: string | null = randomUUID()) => {
    const req = request(app.getHttpServer()).post('/refunds').set('x-api-key', API_KEY);
    if (idempotencyKey) req.set('Idempotency-Key', idempotencyKey);
    return req.send(body);
  };
  const payment = async (orderId: string) =>
    (
      await request(app.getHttpServer())
        .get(`/orders/${orderId}/payment`)
        .set('x-api-key', API_KEY)
    ).body;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetSampleData(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('successful refunds', () => {
    it('completes a full Pix refund and marks the payment as refunded', async () => {
      const res = await refund({ orderId: 'ord_1001', amountCents: 18990, reason: 'Pedido atrasado' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        orderId: 'ord_1001',
        paymentId: 'pay_1001',
        amountCents: 18990,
        status: 'completed',
      });
      expect(res).toMatchContract();
      expect(await payment('ord_1001')).toMatchObject({
        status: 'refunded',
        refundedAmountCents: 18990,
      });
    });

    it('keeps a partial card refund processing', async () => {
      const res = await refund({ orderId: 'ord_1002', amountCents: 10000, reason: 'Defeito' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('processing');
      expect(res).toMatchContract();
      expect(await payment('ord_1002')).toMatchObject({
        status: 'partially_refunded',
        refundedAmountCents: 10000,
      });
    });
  });

  describe('idempotency', () => {
    const body = { orderId: 'ord_1002', amountCents: 10000, reason: 'Defeito' };

    it('requires the Idempotency-Key header', async () => {
      const res = await refund(body, null);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('idempotency_key_required');
      expect(res).toMatchContract();
      expect((await payment('ord_1002')).refundedAmountCents).toBe(0);
    });

    it('returns the original refund when the same request is repeated', async () => {
      const first = await refund(body, 'key-repeat');
      const second = await refund(body, 'key-repeat');

      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(second.headers['idempotent-replayed']).toBe('true');
      expect(second.body).toEqual(first.body);
      expect(second).toMatchContract();
      expect((await payment('ord_1002')).refundedAmountCents).toBe(10000); // não dobrou
    });

    it('rejects the same key with a different body', async () => {
      await refund(body, 'key-reused');
      const res = await refund({ ...body, amountCents: 5000 }, 'key-reused');

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('idempotency_key_reused');
      expect(res).toMatchContract();
    });
  });

  describe('business rules', () => {
    it('rejects a pending payment', async () => {
      const res = await refund({ orderId: 'ord_2002', amountCents: 5990, reason: 'Desistência' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('payment_not_refundable');
      expect(res).toMatchContract();
    });

    it('rejects a payment that was already refunded', async () => {
      const res = await refund({ orderId: 'ord_2001', amountCents: 100, reason: 'De novo' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('payment_not_refundable');
      expect(res).toMatchContract();
    });

    it('rejects more than the refundable amount', async () => {
      const res = await refund({ orderId: 'ord_1002', amountCents: 34901, reason: 'Defeito' });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('amount_exceeds_refundable');
      expect(res).toMatchContract();
    });

    it('never refunds more than was paid with simultaneous requests', async () => {
      const body = { orderId: 'ord_1001', amountCents: 18990, reason: 'Pedido atrasado' };

      const responses = await Promise.all([refund(body), refund(body)]); // chaves diferentes

      expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
      expect((await payment('ord_1001')).refundedAmountCents).toBe(18990);
    });
  });

  describe('invalid requests', () => {
    it('rejects amountCents sent as text', async () => {
      const res = await refund({ orderId: 'ord_1001', amountCents: '10', reason: 'Teste' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('validation_error');
      expect(res).toMatchContract();
    });

    it('rejects fields that are not in the contract', async () => {
      const res = await refund({ orderId: 'ord_1001', amountCents: 10, reason: 'Teste', extra: 1 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('validation_error');
    });

    it('answers 404 for an unknown order', async () => {
      const res = await refund({ orderId: 'ord_9999', amountCents: 10, reason: 'Teste' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('order_not_found');
      expect(res).toMatchContract();
    });
  });
});
