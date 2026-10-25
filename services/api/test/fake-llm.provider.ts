import type { LlmProvider, LlmRequest, LlmResponse } from '../src/llm/llm.types';

/**
 * Provedor de LLM falso. Por padrão, responde "Resposta para: <pergunta>".
 * Com `script`, devolve as respostas roteirizadas em ordem (ex.: pedir uma ferramenta e depois
 * responder), para testar o agente sem uma LLM de verdade.
 */
export class FakeLlmProvider implements LlmProvider {
  readonly name = 'ollama' as const;
  readonly model = 'fake-model';
  requests: LlmRequest[] = [];
  script: LlmResponse[] = [];
  failNext = false;

  async chat(request: LlmRequest): Promise<LlmResponse> {
    this.requests.push(structuredClone(request));
    if (this.failNext) {
      this.failNext = false;
      throw new Error('provider down');
    }
    const scripted = this.script.shift();
    if (scripted) return scripted;

    const last = request.messages.at(-1)?.content[0];
    const question = last?.type === 'text' ? last.text : '';
    return reply(`Resposta para: ${question}`);
  }

  get lastRequest(): LlmRequest | undefined {
    return this.requests.at(-1);
  }

  reset(): void {
    this.requests = [];
    this.script = [];
    this.failNext = false;
  }
}

export function reply(text: string): LlmResponse {
  return {
    content: [{ type: 'text', text }],
    stopReason: 'end_turn',
    usage: { inputTokens: 10, outputTokens: 5 },
    model: 'fake-model',
  };
}

export function askTool(name: string, input: Record<string, unknown>, id = `tu_${name}`): LlmResponse {
  return {
    content: [{ type: 'tool_use', id, name, input }],
    stopReason: 'tool_use',
    usage: { inputTokens: 10, outputTokens: 5 },
    model: 'fake-model',
  };
}
