import type { LlmRequest } from '../llm.types';
import { OllamaProvider } from './ollama.provider';

function fakeFetch(body: object, status = 200) {
  const calls: { url: string; body: any }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const request: LlmRequest = {
  system: 'Você é um assistente.',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'Olá' }] }],
  maxTokens: 256,
};
const signal = new AbortController().signal;

describe('OllamaProvider', () => {
  it('sends system + messages to /api/chat and maps the text answer', async () => {
    const { fn, calls } = fakeFetch({
      model: 'qwen2.5:7b',
      message: { role: 'assistant', content: 'Oi! Como posso ajudar?' },
      done_reason: 'stop',
      prompt_eval_count: 30,
      eval_count: 8,
    });

    const response = await new OllamaProvider('http://ollama:11434', 'qwen2.5:7b', fn).chat(request, signal);

    expect(calls[0].url).toBe('http://ollama:11434/api/chat');
    expect(calls[0].body).toMatchObject({
      model: 'qwen2.5:7b',
      stream: false,
      messages: [
        { role: 'system', content: 'Você é um assistente.' },
        { role: 'user', content: 'Olá' },
      ],
      options: { num_predict: 256 },
    });
    expect(response).toEqual({
      content: [{ type: 'text', text: 'Oi! Como posso ajudar?' }],
      stopReason: 'end_turn',
      usage: { inputTokens: 30, outputTokens: 8 },
      model: 'qwen2.5:7b',
    });
  });

  it('maps tool calls and generates an id for each one', async () => {
    const { fn } = fakeFetch({
      model: 'qwen2.5:7b',
      message: {
        role: 'assistant',
        content: '',
        tool_calls: [{ function: { name: 'get_order', arguments: { orderId: 'ord_1001' } } }],
      },
      done_reason: 'stop',
    });

    const response = await new OllamaProvider('http://x', 'm', fn).chat(request, signal);

    expect(response.stopReason).toBe('tool_use');
    expect(response.content).toEqual([
      { type: 'tool_use', id: expect.stringMatching(/^call_/), name: 'get_order', input: { orderId: 'ord_1001' } },
    ]);
  });

  it('sends tool results as "tool" messages with the tool name', async () => {
    const { fn, calls } = fakeFetch({ model: 'm', message: { role: 'assistant', content: 'ok' } });

    await new OllamaProvider('http://x', 'm', fn).chat(
      {
        ...request,
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'Cadê meu pedido?' }] },
          { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'get_order', input: { orderId: 'o1' } }] },
          { role: 'user', content: [{ type: 'tool_result', toolUseId: 't1', content: { status: 'delayed' } }] },
        ],
        tools: [{ name: 'get_order', description: 'Consulta um pedido', inputSchema: { type: 'object' } }],
      },
      signal,
    );

    expect(calls[0].body.messages.slice(2)).toEqual([
      { role: 'assistant', content: '', tool_calls: [{ function: { name: 'get_order', arguments: { orderId: 'o1' } } }] },
      { role: 'tool', content: '{"status":"delayed"}', tool_name: 'get_order' },
    ]);
    expect(calls[0].body.tools[0]).toEqual({
      type: 'function',
      function: { name: 'get_order', description: 'Consulta um pedido', parameters: { type: 'object' } },
    });
  });

  it('throws when Ollama answers with an error status', async () => {
    const { fn } = fakeFetch({ error: 'model not found' }, 404);

    await expect(new OllamaProvider('http://x', 'm', fn).chat(request, signal)).rejects.toThrow(/404/);
  });
});
