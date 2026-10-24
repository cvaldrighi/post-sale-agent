import { ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import type { LlmMessage, LlmRequest } from '../llm.types';
import { BedrockProvider, normalizeTurns } from './bedrock.provider';

/** Cliente do SDK simulado: guarda o comando enviado e devolve uma resposta fixa. */
function fakeClient(output: object) {
  const sent: ConverseCommand[] = [];
  return {
    sent,
    client: { send: async (command: ConverseCommand) => (sent.push(command), output) } as never,
  };
}

const request: LlmRequest = {
  system: 'Você é um assistente.',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Olá' }] }],
  maxTokens: 512,
};
const signal = new AbortController().signal;

describe('BedrockProvider', () => {
  it('builds a Converse request and maps the text answer', async () => {
    const { client, sent } = fakeClient({
      output: { message: { role: 'assistant', content: [{ text: 'Oi!' }] } },
      stopReason: 'end_turn',
      usage: { inputTokens: 20, outputTokens: 3 },
    });

    const response = await new BedrockProvider(client, 'us.anthropic.claude-haiku-5-5').chat(request, signal);

    expect(sent[0].input).toMatchObject({
      modelId: 'us.anthropic.claude-haiku-5-5',
      system: [{ text: 'Você é um assistente.' }],
      messages: [{ role: 'user', content: [{ text: 'Olá' }] }],
      inferenceConfig: { maxTokens: 512 },
    });
    expect(sent[0].input.toolConfig).toBeUndefined();
    expect(response).toEqual({
      content: [{ type: 'text', text: 'Oi!' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 20, outputTokens: 3 },
      model: 'us.anthropic.claude-haiku-5-5',
    });
  });

  it('sends tools and maps a toolUse answer', async () => {
    const { client, sent } = fakeClient({
      output: {
        message: {
          role: 'assistant',
          content: [{ toolUse: { toolUseId: 'tu_1', name: 'get_order', input: { orderId: 'ord_1001' } } }],
        },
      },
      stopReason: 'tool_use',
      usage: { inputTokens: 50, outputTokens: 12 },
    });

    const response = await new BedrockProvider(client, 'm').chat(
      { ...request, tools: [{ name: 'get_order', description: 'Consulta um pedido', inputSchema: { type: 'object' } }] },
      signal,
    );

    expect(sent[0].input.toolConfig?.tools?.[0]).toEqual({
      toolSpec: { name: 'get_order', description: 'Consulta um pedido', inputSchema: { json: { type: 'object' } } },
    });
    expect(response.stopReason).toBe('tool_use');
    expect(response.content).toEqual([
      { type: 'tool_use', id: 'tu_1', name: 'get_order', input: { orderId: 'ord_1001' } },
    ]);
  });

  it('sends tool results as toolResult blocks', async () => {
    const { client, sent } = fakeClient({
      output: { message: { role: 'assistant', content: [{ text: 'ok' }] } },
      stopReason: 'end_turn',
    });

    await new BedrockProvider(client, 'm').chat(
      {
        ...request,
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'Cadê meu pedido?' }] },
          { role: 'assistant', content: [{ type: 'tool_use', id: 'tu_1', name: 'get_order', input: {} }] },
          { role: 'user', content: [{ type: 'tool_result', toolUseId: 'tu_1', content: { status: 'delayed' } }] },
        ],
      },
      signal,
    );

    expect(sent[0].input.messages?.[2]).toEqual({
      role: 'user',
      content: [{ toolResult: { toolUseId: 'tu_1', content: [{ json: { status: 'delayed' } }], status: 'success' } }],
    });
  });
});

describe('normalizeTurns', () => {
  const text = (role: LlmMessage['role'], value: string): LlmMessage => ({
    role,
    content: [{ type: 'text', text: value }],
  });

  it('drops leading assistant messages', () => {
    expect(normalizeTurns([text('assistant', 'a'), text('user', 'u')])).toEqual([text('user', 'u')]);
  });

  it('merges consecutive messages with the same role', () => {
    expect(normalizeTurns([text('user', 'u1'), text('user', 'u2'), text('assistant', 'a')])).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'u1' }, { type: 'text', text: 'u2' }] },
      text('assistant', 'a'),
    ]);
  });
});
