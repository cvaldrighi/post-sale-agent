import { z } from 'zod';
import { LlmService } from '../llm/llm.service';
import type { LlmResponse } from '../llm/llm.types';
import { AgentService, STEP_LIMIT_REPLY } from './agent.service';
import { defineTool, ToolRegistry, type ToolContext } from './tools/tool';

const context: ToolContext = { conversationId: 'conv-1', customerId: 'cust_001', correlationId: 'corr-1' };
const input = { system: 'prompt', promptVersion: 'v-test', history: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Cadê meu pedido?' }] }] };

const text = (value: string): LlmResponse => ({
  content: [{ type: 'text', text: value }],
  stopReason: 'end_turn',
  usage: { inputTokens: 1, outputTokens: 1 },
  model: 'fake',
});
const toolUse = (name: string, toolInput: Record<string, unknown>, id = 'tu_1'): LlmResponse => ({
  content: [{ type: 'tool_use', id, name, input: toolInput }],
  stopReason: 'tool_use',
  usage: { inputTokens: 1, outputTokens: 1 },
  model: 'fake',
});

function setup(script: LlmResponse[], options: { maxSteps?: number; failingTool?: boolean } = {}) {
  const requests: Parameters<LlmService['chat']>[0][] = [];
  const llm = {
    chat: async (request: Parameters<LlmService['chat']>[0]) => {
      requests.push(structuredClone(request));
      const next = script.shift();
      if (!next) throw new Error('script vazio');
      return next;
    },
  } as unknown as LlmService;

  const executed: unknown[] = [];
  const registry = new ToolRegistry([
    defineTool({
      name: 'get_order',
      description: 'Consulta um pedido',
      input: z.object({ orderId: z.string().min(1) }),
      async execute(args) {
        executed.push(args);
        if (options.failingTool) throw new Error('boom: stack interno');
        return { ok: true, data: { orderId: args.orderId, status: 'delayed' } };
      },
    }),
  ]);

  const toolCalls: Record<string, unknown>[] = [];
  const repo = { insert: async (row: Record<string, unknown>) => void toolCalls.push(row) };
  const logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
  const config = { get: (key: string) => ({ AGENT_MAX_STEPS: options.maxSteps ?? 5, LLM_MAX_TOKENS: 512 })[key] };

  const agent = new AgentService(llm, registry, repo as never, logger as never, config as never);
  return { agent, requests, executed, toolCalls };
}

describe('AgentService', () => {
  it('answers directly when the LLM does not ask for tools', async () => {
    const { agent, executed } = setup([text('Olá!')]);

    await expect(agent.run(input, context)).resolves.toEqual({ reply: 'Olá!', successfulTools: new Set() });
    expect(executed).toHaveLength(0);
  });

  it('runs a requested tool and sends the result back to the LLM', async () => {
    const { agent, requests, executed, toolCalls } = setup([
      toolUse('get_order', { orderId: 'ord_1001' }),
      text('Seu pedido está atrasado.'),
    ]);

    await expect(agent.run(input, context)).resolves.toEqual({
      reply: 'Seu pedido está atrasado.',
      successfulTools: new Set(['get_order']),
    });
    expect(executed).toEqual([{ orderId: 'ord_1001' }]);
    expect(requests[0].tools?.map((t) => t.name)).toEqual(['get_order']);
    expect(requests[1].messages.at(-1)).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', toolUseId: 'tu_1', content: { orderId: 'ord_1001', status: 'delayed' }, isError: false }],
    });
    expect(toolCalls[0]).toMatchObject({ toolName: 'get_order', outcome: 'success', errorCode: null });
  });

  it('returns an error to the LLM for a tool that does not exist, without running anything', async () => {
    const { agent, requests, executed, toolCalls } = setup([toolUse('delete_order', { orderId: 'x' }), text('ok')]);

    await agent.run(input, context);

    expect(executed).toHaveLength(0);
    const result = requests[1].messages.at(-1)!.content[0];
    expect(result).toMatchObject({ type: 'tool_result', isError: true, content: { error: 'unknown_tool' } });
    expect(toolCalls[0]).toMatchObject({ toolName: 'delete_order', outcome: 'error', errorCode: 'unknown_tool' });
  });

  it('returns a validation error to the LLM for invalid parameters', async () => {
    const { agent, requests, executed } = setup([toolUse('get_order', {}), text('ok')]);

    await agent.run(input, context);

    expect(executed).toHaveLength(0);
    expect(requests[1].messages.at(-1)!.content[0]).toMatchObject({ isError: true, content: { error: 'invalid_input' } });
  });

  it('hides unexpected tool errors from the LLM', async () => {
    const { agent, requests } = setup([toolUse('get_order', { orderId: 'ord_1001' }), text('ok')], { failingTool: true });

    await agent.run(input, context);

    const result = JSON.stringify(requests[1].messages.at(-1));
    expect(result).toContain('internal_error');
    expect(result).not.toContain('stack interno');
  });

  it('runs identical requests of the same step only once, answering each of them', async () => {
    const duplicated: LlmResponse = {
      content: [
        { type: 'tool_use', id: 'tu_a', name: 'get_order', input: { orderId: 'ord_1001' } },
        { type: 'tool_use', id: 'tu_b', name: 'get_order', input: { orderId: 'ord_1001' } },
        { type: 'tool_use', id: 'tu_c', name: 'get_order', input: { orderId: 'ord_1001' } },
        { type: 'tool_use', id: 'tu_d', name: 'get_order', input: { orderId: 'ord_1002' } },
      ],
      stopReason: 'tool_use',
      usage: { inputTokens: 1, outputTokens: 1 },
      model: 'fake',
    };
    const { agent, requests, executed, toolCalls } = setup([duplicated, text('ok')]);

    await agent.run(input, context);

    expect(executed).toEqual([{ orderId: 'ord_1001' }, { orderId: 'ord_1002' }]);
    expect(toolCalls).toHaveLength(2);
    const results = requests[1].messages.at(-1)!.content as { toolUseId: string; content: unknown }[];
    expect(results.map((r) => r.toolUseId)).toEqual(['tu_a', 'tu_b', 'tu_c', 'tu_d']);
    expect(results[1].content).toEqual(results[0].content);
  });

  it('stops at the step limit with a fixed reply', async () => {
    const script = Array.from({ length: 6 }, (_, i) => toolUse('get_order', { orderId: 'ord_1001' }, `tu_${i}`));
    const { agent, requests } = setup(script, { maxSteps: 3 });

    await expect(agent.run(input, context)).resolves.toMatchObject({ reply: STEP_LIMIT_REPLY });
    expect(requests).toHaveLength(3);
  });
});
