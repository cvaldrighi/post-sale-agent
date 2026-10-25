import request from 'supertest';
import { DataSource } from 'typeorm';
import { ASSISTANT_PROMPT_VERSION } from '../src/prompts/prompts';
import { createTestApp, resetDatabase, type TestContext, tokenFor } from './test-app';

describe('Conversations (e2e)', () => {
  let ctx: TestContext;
  let ana: string; // token de cust_001
  let bruno: string; // token de cust_002

  const server = () => ctx.app.getHttpServer();
  const createConversation = async (token: string) =>
    (await request(server()).post('/conversations').set('Authorization', `Bearer ${token}`)).body
      .id as string;
  const send = (token: string, conversationId: string, content: string) =>
    request(server())
      .post(`/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content });
  const get = (token: string, conversationId: string) =>
    request(server()).get(`/conversations/${conversationId}`).set('Authorization', `Bearer ${token}`);
  const db = () => ctx.app.get(DataSource);

  beforeAll(async () => {
    ctx = await createTestApp();
    ana = await tokenFor(ctx.app, 'cust_001');
    bruno = await tokenFor(ctx.app, 'cust_002');
  });

  beforeEach(async () => {
    await resetDatabase(ctx.app);
    ctx.llm.reset();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('creates a conversation for the token customer', async () => {
    const res = await request(server()).post('/conversations').set('Authorization', `Bearer ${ana}`);

    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    const [row] = await db().query('SELECT customer_id FROM app.conversations WHERE id = $1', [res.body.id]);
    expect(row.customer_id).toBe('cust_001');
  });

  it('answers a message with the LLM reply and keeps both messages in order', async () => {
    const conversationId = await createConversation(ana);

    const res = await send(ana, conversationId, 'Olá, preciso de ajuda');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ role: 'assistant', content: 'Resposta para: Olá, preciso de ajuda' });

    const conversation = await get(ana, conversationId);
    expect(conversation.status).toBe(200);
    expect(conversation.body.messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant']);
  });

  it('sends the system prompt and the conversation to the LLM', async () => {
    const conversationId = await createConversation(ana);

    await send(ana, conversationId, 'Oi');

    expect(ctx.llm.lastRequest?.system).toContain('assistente de pós-venda');
    expect(ctx.llm.lastRequest?.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'Oi' }] }]);
  });

  it('records the LLM call with tokens, latency and prompt version', async () => {
    const conversationId = await createConversation(ana);

    await send(ana, conversationId, 'Oi');

    const [call] = await db().query('SELECT * FROM app.llm_calls WHERE conversation_id = $1', [conversationId]);
    expect(call).toMatchObject({
      provider: 'ollama',
      model: 'fake-model',
      prompt_version: ASSISTANT_PROMPT_VERSION,
      input_tokens: 10,
      output_tokens: 5,
      stop_reason: 'end_turn',
      error: null,
    });
    expect(call.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('sends only the 20 most recent messages, oldest first', async () => {
    const conversationId = await createConversation(ana);
    for (let i = 1; i <= 30; i++) {
      await db().query(
        'INSERT INTO app.messages (conversation_id, role, content) VALUES ($1, $2, $3)',
        [conversationId, i % 2 === 1 ? 'user' : 'assistant', `mensagem ${i}`],
      );
    }

    await send(ana, conversationId, 'mensagem 31');

    const texts = ctx.llm.lastRequest!.messages.map((m) => (m.content[0] as { text: string }).text);
    expect(texts).toHaveLength(20);
    expect(texts[0]).toBe('mensagem 12');
    expect(texts[19]).toBe('mensagem 31');
  });

  it('rejects an empty message without calling the LLM', async () => {
    const conversationId = await createConversation(ana);

    const res = await send(ana, conversationId, '');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('validation_error');
    expect(ctx.llm.requests).toHaveLength(0);
  });

  it('keeps the customer message and answers 503 when the LLM fails', async () => {
    const conversationId = await createConversation(ana);
    ctx.llm.failNext = true;

    const res = await send(ana, conversationId, 'Oi');

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('llm_unavailable');
    const conversation = await get(ana, conversationId);
    expect(conversation.body.messages.map((m: { role: string }) => m.role)).toEqual(['user']);
    const [call] = await db().query('SELECT error FROM app.llm_calls WHERE conversation_id = $1', [conversationId]);
    expect(call.error).toContain('provider down');
  });

  describe('isolation between customers', () => {
    it('hides a conversation from another customer (404, not 403)', async () => {
      const conversationId = await createConversation(ana);

      const read = await get(bruno, conversationId);
      const write = await send(bruno, conversationId, 'Oi');

      expect(read.status).toBe(404);
      expect(read.body.code).toBe('conversation_not_found');
      expect(write.status).toBe(404);
      expect(ctx.llm.requests).toHaveLength(0);
    });

    it('answers 404 for a conversation that does not exist', async () => {
      const res = await get(ana, '00000000-0000-4000-8000-000000000000');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('conversation_not_found');
    });

    it('answers 404 (not 500) for an id that is not a UUID', async () => {
      const res = await get(ana, 'not-a-uuid');

      expect(res.status).toBe(404);
    });
  });
});
