import request from 'supertest';
import { DataSource } from 'typeorm';
import { ActionsService } from '../src/actions/actions.service';
import { askTool, reply } from './fake-llm.provider';
import { startOrdersStub, type OrdersStub } from './orders-stub';
import { createTestApp, resetDatabase, type TestContext, tokenFor } from './test-app';

describe('Customer approval of actions (e2e)', () => {
  let ctx: TestContext;
  let stub: OrdersStub;
  let ana: string;
  let bruno: string;

  const server = () => ctx.app.getHttpServer();
  const db = () => ctx.app.get(DataSource);
  const refundRequests = () => stub.requests.filter((r) => r.method === 'POST' && r.url === '/refunds');

  /** Uma proposta de estorno de ord_1001 numa conversa de cust_001, como a ferramenta faria. */
  async function proposeRefund() {
    const conversation = await request(server()).post('/conversations').set('Authorization', `Bearer ${ana}`);
    return ctx.app.get(ActionsService).proposeRefund({
      conversationId: conversation.body.id as string,
      customerId: 'cust_001',
      orderId: 'ord_1001',
      amountCents: 18990,
      reason: 'Pedido atrasado',
    });
  }
  const approve = (id: string, token = ana) =>
    request(server()).post(`/actions/${id}/approve`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    stub = await startOrdersStub();
    ctx = await createTestApp();
    ana = await tokenFor(ctx.app, 'cust_001');
    bruno = await tokenFor(ctx.app, 'cust_002');
  });

  beforeEach(async () => {
    await resetDatabase(ctx.app);
    ctx.llm.reset();
    stub.requests = [];
    stub.down = false;
    stub.refundError = null;
    stub.refunds.clear();
  });

  afterAll(async () => {
    await ctx.app.close();
    await stub.close();
  });

  it('executes the refund with the action id as idempotency key and tells the conversation', async () => {
    const action = await proposeRefund();
    expect(refundRequests()).toHaveLength(0); // propor não estorna

    const res = await approve(action.id).set('x-correlation-id', 'approve-123');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: action.id, status: 'executed', refund: { status: 'completed' } });
    expect(refundRequests()).toHaveLength(1);
    expect(refundRequests()[0].headers['idempotency-key']).toBe(action.id);
    expect(refundRequests()[0].headers['x-correlation-id']).toBe('approve-123');
    expect(refundRequests()[0].body).toEqual({
      orderId: 'ord_1001',
      amountCents: 18990,
      reason: 'Pedido atrasado',
    });

    const [message] = await db().query(
      `SELECT role, content FROM app.messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT 1`,
      [action.conversationId],
    );
    expect(message).toEqual({
      role: 'assistant',
      content: 'Estorno de R$ 189,90 do pedido ord_1001 concluído.',
    });
  });

  it('answers a second approval with 409 and never refunds twice', async () => {
    const action = await proposeRefund();

    await approve(action.id);
    const second = await approve(action.id);

    expect(second.status).toBe(409);
    expect(second.body.code).toBe('action_not_pending');
    expect(refundRequests()).toHaveLength(1);
  });

  it('executes only once when two approvals arrive at the same time', async () => {
    const action = await proposeRefund();

    const responses = await Promise.all([approve(action.id), approve(action.id)]);

    expect(responses.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);
    expect(refundRequests()).toHaveLength(1);
  });

  it('refuses an expired action', async () => {
    const action = await proposeRefund();
    await db().query(
      `UPDATE app.pending_actions SET expires_at = now() - interval '1 minute' WHERE id = $1`,
      [action.id],
    );

    const res = await approve(action.id);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('action_expired');
    expect(refundRequests()).toHaveLength(0);
  });

  it('hides an action of another customer as if it did not exist', async () => {
    const action = await proposeRefund();

    const res = await approve(action.id, bruno);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('action_not_found');
    expect(refundRequests()).toHaveLength(0);
  });

  it('keeps the action pending when the orders service is down, so it can be approved again', async () => {
    const action = await proposeRefund();
    stub.down = true;

    const res = await approve(action.id);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('orders_unavailable');
    expect(refundRequests()).toHaveLength(3); // as 3 tentativas, todas com a mesma chave
    const keys = new Set(refundRequests().map((r) => r.headers['idempotency-key']));
    expect(keys).toEqual(new Set([action.id]));

    stub.down = false;
    const retry = await approve(action.id);
    expect(retry.status).toBe(200);
    expect(retry.body.status).toBe('executed');
  });

  it('marks the action as failed when the orders service refuses the refund', async () => {
    const action = await proposeRefund();
    stub.refundError = { status: 409, code: 'payment_not_refundable' };

    const res = await approve(action.id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'failed', errorCode: 'payment_not_refundable' });
    expect(refundRequests()).toHaveLength(1); // regra de negócio: sem retry
  });

  it('lets the customer reject the action without calling the orders service', async () => {
    const action = await proposeRefund();

    const res = await request(server())
      .post(`/actions/${action.id}/reject`)
      .set('Authorization', `Bearer ${ana}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(refundRequests()).toHaveLength(0);
    expect((await approve(action.id)).body.code).toBe('action_not_pending');
  });

  it('reuses the pending proposal of the same order', async () => {
    const first = await proposeRefund();
    const second = await proposeRefund();

    expect(second.id).toBe(first.id);
    const [{ count }] = await db().query(`SELECT count(*)::int AS count FROM app.pending_actions`);
    expect(count).toBe(1);
  });

  describe('through the conversation', () => {
    const send = async (content: string) => {
      const conversation = await request(server())
        .post('/conversations')
        .set('Authorization', `Bearer ${ana}`);
      return request(server())
        .post(`/conversations/${conversation.body.id}/messages`)
        .set('Authorization', `Bearer ${ana}`)
        .send({ content });
    };

    it('returns the proposal created by request_refund, without refunding', async () => {
      ctx.llm.script = [
        askTool('request_refund', { orderId: 'ord_1001', reason: 'Pedido atrasado' }),
        reply('Preparei o estorno de R$ 189,90. Aprove para ele acontecer.'),
      ];

      const res = await send('Quero o estorno do pedido ord_1001, ele atrasou');

      expect(res.status).toBe(201);
      expect(res.body.pendingAction).toMatchObject({
        type: 'refund',
        orderId: 'ord_1001',
        amountCents: 18990,
      });
      const [row] = await db().query(`SELECT id, status FROM app.pending_actions`);
      expect(row).toEqual({ id: res.body.pendingAction.id, status: 'pending' });
      expect(refundRequests()).toHaveLength(0);
    });

    it('returns null when there is nothing to approve', async () => {
      const res = await send('Olá');

      expect(res.status).toBe(201);
      expect(res.body.pendingAction).toBeNull();
    });
  });

  it('requires a token', async () => {
    const action = await proposeRefund();

    expect((await request(server()).post(`/actions/${action.id}/approve`)).status).toBe(401);
  });
});
