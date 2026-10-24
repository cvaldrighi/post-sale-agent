import { randomUUID } from 'node:crypto';
import type { LlmContentBlock, LlmMessage, LlmProvider, LlmRequest, LlmResponse } from '../llm.types';

/** Formato de mensagem da API /api/chat do Ollama. */
interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[];
  tool_name?: string;
}

interface OllamaChatResponse {
  model: string;
  message: OllamaMessage;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

/** Adaptador do Ollama (LLM local), chamado por HTTP sem SDK. */
export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama' as const;

  constructor(
    private readonly baseUrl: string,
    readonly model: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async chat(request: LlmRequest, signal: AbortSignal): Promise<LlmResponse> {
    const response = await this.fetchFn(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: toOllamaMessages(request),
        ...(request.tools?.length
          ? {
              tools: request.tools.map((tool) => ({
                type: 'function',
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.inputSchema,
                },
              })),
            }
          : {}),
        options: { num_predict: request.maxTokens, temperature: 0.2 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama respondeu ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const content: LlmContentBlock[] = [];
    if (data.message.content) content.push({ type: 'text', text: data.message.content });
    for (const call of data.message.tool_calls ?? []) {
      // O Ollama não dá ID aos pedidos de ferramenta; geramos um para ligar ao resultado
      content.push({
        type: 'tool_use',
        id: `call_${randomUUID()}`,
        name: call.function.name,
        input: call.function.arguments,
      });
    }

    return {
      content,
      stopReason: data.message.tool_calls?.length
        ? 'tool_use'
        : data.done_reason === 'length'
          ? 'max_tokens'
          : 'end_turn',
      usage: { inputTokens: data.prompt_eval_count ?? 0, outputTokens: data.eval_count ?? 0 },
      model: data.model,
    };
  }
}

function toOllamaMessages(request: LlmRequest): OllamaMessage[] {
  const toolNames = new Map<string, string>(); // tool_use id → nome, para os resultados
  const messages: OllamaMessage[] = [{ role: 'system', content: request.system }];

  for (const message of request.messages) {
    messages.push(...convertMessage(message, toolNames));
  }
  return messages;
}

function convertMessage(message: LlmMessage, toolNames: Map<string, string>): OllamaMessage[] {
  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  if (message.role === 'assistant') {
    const toolUses = message.content.filter((block) => block.type === 'tool_use');
    toolUses.forEach((block) => toolNames.set(block.id, block.name));
    return [
      {
        role: 'assistant',
        content: text,
        ...(toolUses.length
          ? { tool_calls: toolUses.map((b) => ({ function: { name: b.name, arguments: b.input } })) }
          : {}),
      },
    ];
  }

  // No Ollama, cada resultado de ferramenta é uma mensagem separada com role "tool"
  const results = message.content
    .filter((block) => block.type === 'tool_result')
    .map(
      (block): OllamaMessage => ({
        role: 'tool',
        content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content),
        tool_name: toolNames.get(block.toolUseId),
      }),
    );
  return text ? [...results, { role: 'user', content: text }] : results;
}
