import request from 'supertest';
import { DataSource } from 'typeorm';
import { STEP_LIMIT_REPLY } from '../src/agent/agent.service';
import { askTool, reply } from './fake-llm.provider';
import { startOrdersStub, type OrdersStub } from './orders-stub';
import { createTestApp, resetDatabase, type TestContext, tokenFor } from './test-app';

describe('Agent with order tools (e2e)', () => {
  let ctx: TestContext;
  let stub: OrdersStub;
  let ana: string;

  const server = () => ctx.app.getHttpServer();
  const db = () => ctx.app.get(DataSource);
  const ask = async (content: string, correlationId = 'e2e-corr') => {
    const conversation = await request(server()).post('/conversations').set('Authorization', `Bearer ${ana}`);
    return request(server())
      .post(`/conversations/${conversation.body.id}/messages`)
      .set('Authorization', `Bearer ${ana}`)
      .set('x-correlation-id', correlationId)
      .send({ content });
  };
  /** O resultado de ferramenta que a LLM recebeu na segunda chamada. */
  const toolResultSentToLlm = () => ctx.llm.requests[1].messages.at(-1)!.content[0];

  beforeAll(async () => {
    stub = await startOrdersStub();
    ctx = await createTestApp();
    ana = await tokenFor(ctx.app, 'cust_001');
  });

  beforeEach(async () => {
    await resetDatabase(ctx.app);
    ctx.llm.reset();
    stub.requests = [];
    stub.down = false;
  });

  afterAll(async () => {
    await ctx.app.close();
    await stub.close();
  });

  it('consults the order and answers with the final LLM reply', async () => {
    ctx.llm.script = [askTool('get_order', { orderId: 'ord_1001' }), reply('Seu pedido está atrasado.')];

    const res = await ask('Cadê meu pedido ord_1001?');

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Seu pedido está atrasado.');
    expect(toolResultSentToLlm()).toMatchObject({
      type: 'tool_result',
      isError: false,
      content: { orderId: 'ord_1001', status: 'delayed', total: 'R$ 189,90' },
    });
    expect(JSON.stringify(toolResultSentToLlm())).not.toContain('123.456.789-09'); // sem CPF
    const [call] = await db().query('SELECT tool_name, outcome FROM app.tool_calls');
    expect(call).toEqual({ tool_name: 'get_order', outcome: 'success' });
  });

  it('offers the tools to the LLM', async () => {
    await ask('Olá');

    expect(ctx.llm.requests[0].tools?.map((t) => t.name)).toEqual(['list_my_orders', 'get_order', 'get_payment']);
  });

  it('denies an order of another customer as if it did not exist', async () => {
    ctx.llm.script = [askTool('get_order', { orderId: 'ord_2001' }), reply('Não encontrei esse pedido.')];

    const res = await ask('Qual o status do pedido ord_2001?');

    expect(res.status).toBe(201);
    expect(toolResultSentToLlm()).toMatchObject({ isError: true, content: { error: 'order_not_found' } });
    expect(JSON.stringify(toolResultSentToLlm())).not.toContain('cust_002');
    const [call] = await db().query('SELECT outcome, error_code FROM app.tool_calls');
    expect(call).toEqual({ outcome: 'denied', error_code: 'order_not_found' });
  });

  it('keeps the conversation going when the orders service is down', async () => {
    stub.down = true;
    ctx.llm.script = [askTool('get_order', { orderId: 'ord_1001' }), reply('Não consegui consultar agora.')];

    const res = await ask('Cadê meu pedido ord_1001?');

    expect(res.status).toBe(201);
    expect(toolResultSentToLlm()).toMatchObject({ isError: true, content: { error: 'orders_unavailable' } });
    expect(stub.requests).toHaveLength(3); // 3 tentativas
  });

  it('propagates the correlation id to the orders service', async () => {
    ctx.llm.script = [askTool('get_order', { orderId: 'ord_1001' }), reply('ok')];

    await ask('Cadê meu pedido ord_1001?', 'trace-me-123');

    expect(stub.requests[0].headers['x-correlation-id']).toBe('trace-me-123');
  });

  it('answers with a fixed reply when the step limit is reached', async () => {
    ctx.llm.script = Array.from({ length: 5 }, (_, i) => askTool('get_order', { orderId: 'ord_1001' }, `tu_${i}`));

    const res = await ask('Cadê meu pedido?');

    expect(res.status).toBe(201);
    expect(res.body.content).toBe(STEP_LIMIT_REPLY);
    expect(ctx.llm.requests).toHaveLength(5);
  });
});
