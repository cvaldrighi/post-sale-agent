import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import type { EnvironmentVariables } from '../config/env.validation';
import { LlmCall } from './entities/llm-call.entity';
import { LLM_PROVIDER, type LlmProvider, type LlmRequest, type LlmResponse } from './llm.types';

export interface LlmCallContext {
  conversationId: string;
  promptVersion: string;
}

/** Falha ao obter resposta da LLM (erro do provedor ou tempo limite). */
export class LlmUnavailableError extends Error {
  constructor(
    message: string,
    readonly timedOut: boolean,
  ) {
    super(message);
  }
}

/**
 * Ponto único de chamada à LLM: aplica o tempo limite, mede a latência e registra cada
 * chamada (tabela llm_calls + linha de log com o correlation ID), com sucesso ou erro.
 */
@Injectable()
export class LlmService {
  private readonly timeoutMs: number;

  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    @InjectRepository(LlmCall) private readonly calls: Repository<LlmCall>,
    @InjectPinoLogger(LlmService.name) private readonly logger: PinoLogger,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.timeoutMs = config.get('LLM_TIMEOUT_MS', { infer: true });
  }

  async chat(request: LlmRequest, context: LlmCallContext): Promise<LlmResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const started = performance.now();

    try {
      const response = await this.provider.chat(request, controller.signal);
      const latencyMs = Math.round(performance.now() - started);
      await this.record(context, latencyMs, { response });
      this.logger.info(
        {
          conversationId: context.conversationId,
          provider: this.provider.name,
          model: response.model,
          promptVersion: context.promptVersion,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          latencyMs,
          stopReason: response.stopReason,
        },
        'LLM call succeeded',
      );
      return response;
    } catch (error) {
      const latencyMs = Math.round(performance.now() - started);
      const timedOut = controller.signal.aborted;
      const message = timedOut
        ? `Tempo limite de ${this.timeoutMs} ms excedido`
        : error instanceof Error
          ? error.message
          : String(error);
      await this.record(context, latencyMs, { error: message });
      this.logger.warn(
        { conversationId: context.conversationId, provider: this.provider.name, latencyMs, timedOut, error: message },
        'LLM call failed',
      );
      throw new LlmUnavailableError(message, timedOut);
    } finally {
      clearTimeout(timer);
    }
  }

  private async record(
    context: LlmCallContext,
    latencyMs: number,
    result: { response?: LlmResponse; error?: string },
  ): Promise<void> {
    await this.calls.insert({
      conversationId: context.conversationId,
      provider: this.provider.name,
      model: result.response?.model ?? this.provider.model,
      promptVersion: context.promptVersion,
      inputTokens: result.response?.usage.inputTokens ?? null,
      outputTokens: result.response?.usage.outputTokens ?? null,
      latencyMs,
      stopReason: result.response?.stopReason ?? null,
      error: result.error ?? null,
    });
  }
}
