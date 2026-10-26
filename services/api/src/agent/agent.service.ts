import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import { z } from 'zod';
import type { EnvironmentVariables } from '../config/env.validation';
import { LlmService, LlmUnavailableError } from '../llm/llm.service';
import { textOf, type LlmContentBlock, type LlmMessage } from '../llm/llm.types';
import { ToolCall, type ToolOutcome } from './entities/tool-call.entity';
import { ToolRegistry, type ToolContext, type ToolResult } from './tools/tool';

export const STEP_LIMIT_REPLY =
  'Desculpe, não consegui concluir sua solicitação agora. Pode reformular a pergunta ou tentar ' +
  'novamente em alguns minutos?';

export interface AgentResult {
  reply: string;
  /** Ferramentas que deram certo pelo menos uma vez nesta mensagem (usado pelos guardrails). */
  successfulTools: ReadonlySet<string>;
}

export interface AgentInput {
  system: string;
  promptVersion: string;
  history: LlmMessage[];
}

type ToolUseBlock = Extract<LlmContentBlock, { type: 'tool_use' }>;
type ToolResultBlock = Extract<LlmContentBlock, { type: 'tool_result' }>;

/**
 * O ciclo do agente: a LLM decide quais ferramentas usar; o código decide se e como elas rodam.
 *
 *   para cada passo (até AGENT_MAX_STEPS):
 *     pede à LLM a próxima ação, oferecendo as ferramentas
 *     se ela respondeu com texto → fim
 *     senão executa cada ferramenta pedida e devolve os resultados à LLM
 */
@Injectable()
export class AgentService {
  private readonly maxSteps: number;
  private readonly maxTokens: number;

  constructor(
    private readonly llm: LlmService,
    private readonly tools: ToolRegistry,
    @InjectRepository(ToolCall) private readonly toolCalls: Repository<ToolCall>,
    @InjectPinoLogger(AgentService.name) private readonly logger: PinoLogger,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxSteps = config.get('AGENT_MAX_STEPS', { infer: true });
    this.maxTokens = config.get('LLM_MAX_TOKENS', { infer: true });
  }

  async run(input: AgentInput, context: ToolContext): Promise<AgentResult> {
    const messages: LlmMessage[] = [...input.history];
    const tools = this.tools.definitions();
    const successfulTools = new Set<string>();

    for (let step = 1; step <= this.maxSteps; step++) {
      const response = await this.llm.chat(
        { system: input.system, messages, tools, maxTokens: this.maxTokens },
        { conversationId: context.conversationId, promptVersion: input.promptVersion },
      );

      const toolUses = response.content.filter(
        (block): block is ToolUseBlock => block.type === 'tool_use',
      );
      if (toolUses.length === 0) {
        const reply = textOf(response.content);
        if (!reply) throw new LlmUnavailableError('A LLM respondeu sem texto', false);
        return { reply, successfulTools };
      }

      // O pedido da LLM entra no histórico do ciclo, seguido de um resultado por ferramenta
      const results = await this.executeTools(toolUses, context);
      toolUses.forEach((toolUse, index) => {
        if (!results[index].isError) successfulTools.add(toolUse.name);
      });
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: results });
    }

    this.logger.warn(
      { conversationId: context.conversationId, maxSteps: this.maxSteps },
      'Agent step limit reached',
    );
    return { reply: STEP_LIMIT_REPLY, successfulTools };
  }

  /**
   * Executa os pedidos de um passo. Pedidos idênticos (mesma ferramenta, mesmos parâmetros)
   * rodam uma vez só; cada pedido recebe o seu resultado, porque a LLM espera um por pedido.
   */
  private async executeTools(toolUses: ToolUseBlock[], context: ToolContext): Promise<ToolResultBlock[]> {
    const executed = new Map<string, ToolResultBlock>();
    const results: ToolResultBlock[] = [];

    for (const toolUse of toolUses) {
      const key = `${toolUse.name}:${stableStringify(toolUse.input ?? {})}`;
      const previous = executed.get(key);
      if (previous) {
        results.push({ ...previous, toolUseId: toolUse.id });
        continue;
      }
      const result = await this.executeTool(toolUse, context);
      executed.set(key, result);
      results.push(result);
    }

    const duplicates = toolUses.length - executed.size;
    if (duplicates > 0) {
      this.logger.info(
        { conversationId: context.conversationId, duplicates },
        'Duplicate tool requests skipped',
      );
    }
    return results;
  }

  /** Executa uma ferramenta sem nunca lançar erro: toda falha vira um resultado para a LLM. */
  private async executeTool(toolUse: ToolUseBlock, context: ToolContext): Promise<ToolResultBlock> {
    const started = performance.now();
    const result = await this.resolve(toolUse, context);
    const latencyMs = Math.round(performance.now() - started);
    const outcome: ToolOutcome = result.ok ? 'success' : result.outcome;
    const errorCode = result.ok ? null : result.code;

    await this.toolCalls.insert({
      conversationId: context.conversationId,
      toolName: toolUse.name,
      input: toolUse.input ?? {},
      outcome,
      errorCode,
      latencyMs,
    });
    this.logger.info(
      { conversationId: context.conversationId, tool: toolUse.name, outcome, errorCode, latencyMs },
      'Tool executed',
    );

    return {
      type: 'tool_result',
      toolUseId: toolUse.id,
      content: result.ok ? result.data : { error: result.code, message: result.message },
      isError: !result.ok,
    };
  }

  private async resolve(toolUse: ToolUseBlock, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(toolUse.name);
    if (!tool) {
      return {
        ok: false,
        code: 'unknown_tool',
        message: `A ferramenta "${toolUse.name}" não existe. Disponíveis: ${this.tools.names().join(', ')}.`,
        outcome: 'error',
      };
    }

    // A LLM pode mandar parâmetros errados: valida antes de executar qualquer coisa
    const parsed = tool.input.safeParse(toolUse.input ?? {});
    if (!parsed.success) {
      return {
        ok: false,
        code: 'invalid_input',
        message: `Parâmetros inválidos para ${tool.name}: ${z.prettifyError(parsed.error)}`,
        outcome: 'error',
      };
    }

    try {
      return await tool.execute(parsed.data, context);
    } catch (error) {
      // Erro inesperado: detalhe só no log, nunca para a LLM
      this.logger.error({ err: error, tool: tool.name }, 'Tool failed unexpectedly');
      return {
        ok: false,
        code: 'internal_error',
        message: 'Não foi possível concluir a consulta agora.',
        outcome: 'error',
      };
    }
  }
}

/** JSON com as chaves ordenadas: {a:1,b:2} e {b:2,a:1} viram o mesmo texto. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
