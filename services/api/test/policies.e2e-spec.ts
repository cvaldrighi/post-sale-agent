import request from 'supertest';
import { DataSource } from 'typeorm';
import { askTool, reply } from './fake-llm.provider';
import { PIX_RULE, startRetrievalStub, type RetrievalStub } from './retrieval-stub';
import { createTestApp, resetDatabase, type TestContext, tokenFor } from './test-app';

describe('Agent with the policy search tool (e2e)', () => {
  let ctx: TestContext;
  let stub: RetrievalStub;
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
    stub = await startRetrievalStub();
    ctx = await createTestApp();
    ana = await tokenFor(ctx.app, 'cust_001');
  });

  beforeEach(async () => {
    await resetDatabase(ctx.app);
    ctx.llm.reset();
    stub.requests = [];
    stub.down = false;
    stub.results = [PIX_RULE];
  });

  afterAll(async () => {
    await ctx.app.close();
    await stub.close();
  });

  it('searches the policies and gives the LLM only policy, section and text', async () => {
    ctx.llm.script = [
      askTool('search_policies', { query: 'prazo do estorno no Pix' }),
      reply('Pela nossa Política de Estornos, o dinheiro volta em até 1 dia útil.'),
    ];

    const res = await ask('Em quanto tempo o dinheiro volta no Pix?');

    expect(res.status).toBe(201);
    expect(res.body.content).toContain('Política de Estornos');
    expect(stub.requests[0].body).toEqual({ query: 'prazo do estorno no Pix', topK: 4 });
    expect(toolResultSentToLlm()).toEqual({
      type: 'tool_result',
      toolUseId: expect.any(String),
      isError: false,
      content: {
        results: [{ policy: PIX_RULE.documentTitle, section: PIX_RULE.section, text: PIX_RULE.text }],
      },
    });
    const [call] = await db().query('SELECT tool_name, outcome FROM app.tool_calls');
    expect(call).toEqual({ tool_name: 'search_policies', outcome: 'success' });
  });

  it('tells the LLM that no policy covers the subject', async () => {
    stub.results = [];
    ctx.llm.script = [
      askTool('search_policies', { query: 'produto personalizado' }),
      reply('Não encontrei.'),
    ];

    await ask('Vocês aceitam devolução de produto personalizado?');

    expect(toolResultSentToLlm()).toMatchObject({
      isError: false,
      content: { results: [], message: 'Nenhuma política da loja trata deste assunto.' },
    });
  });

  it('keeps the conversation going when the retrieval is down', async () => {
    stub.down = true;
    ctx.llm.script = [
      askTool('search_policies', { query: 'trocas' }),
      reply('Não consegui consultar agora.'),
    ];

    const res = await ask('Posso trocar um produto?');

    expect(res.status).toBe(201);
    expect(stub.requests).toHaveLength(3); // 3 tentativas, sem uma quarta
    expect(toolResultSentToLlm()).toMatchObject({
      isError: true,
      content: { error: 'policies_unavailable' },
    });
    const [call] = await db().query('SELECT outcome, error_code FROM app.tool_calls');
    expect(call).toEqual({ outcome: 'error', error_code: 'policies_unavailable' });
  });

  it('propagates the correlation id and sends the API key', async () => {
    ctx.llm.script = [askTool('search_policies', { query: 'Pix' }), reply('Ok.')];

    await ask('Prazo do Pix?', 'abc-123');

    expect(stub.requests[0].headers['x-correlation-id']).toBe('abc-123');
    expect(stub.requests[0].headers['x-api-key']).toBe('stub-retrieval-key-0123456789');
  });
});
