import type { LlmProvider, LlmRequest, LlmResponse } from '../src/llm/llm.types';

/** Provedor de LLM falso: responde algo previsível e guarda o que recebeu. */
export class FakeLlmProvider implements LlmProvider {
  readonly name = 'ollama' as const;
  readonly model = 'fake-model';
  requests: LlmRequest[] = [];
  failNext = false;

  async chat(request: LlmRequest): Promise<LlmResponse> {
    this.requests.push(request);
    if (this.failNext) {
      this.failNext = false;
      throw new Error('provider down');
    }
    const last = request.messages.at(-1)?.content[0];
    const question = last?.type === 'text' ? last.text : '';
    return {
      content: [{ type: 'text', text: `Resposta para: ${question}` }],
      stopReason: 'end_turn',
      usage: { inputTokens: 10, outputTokens: 5 },
      model: this.model,
    };
  }

  get lastRequest(): LlmRequest | undefined {
    return this.requests.at(-1);
  }
}
