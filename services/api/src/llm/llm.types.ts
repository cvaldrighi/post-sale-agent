/**
 * Tipos neutros de conversa com LLM, independentes de fornecedor.
 *
 * O formato de "blocos de conteúdo" segue a Converse API do Bedrock, o mais geral entre os
 * provedores: uma mensagem pode ter texto, um pedido de ferramenta (tool_use) ou o resultado
 * de uma ferramenta (tool_result). Cada adaptador converte para o formato do seu provedor.
 */

export type LlmContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolUseId: string; content: unknown; isError?: boolean };

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: LlmContentBlock[];
}

/** Ferramenta oferecida à LLM. `inputSchema` é um JSON Schema dos parâmetros. */
export interface LlmToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  maxTokens: number;
}

/** Por que a LLM parou: terminou, quer usar uma ferramenta, ou bateu no limite de tokens. */
export type LlmStopReason = 'end_turn' | 'tool_use' | 'max_tokens' | 'other';

export interface LlmResponse {
  content: LlmContentBlock[];
  stopReason: LlmStopReason;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

export interface LlmProvider {
  readonly name: 'ollama' | 'bedrock';
  readonly model: string;
  chat(request: LlmRequest, signal: AbortSignal): Promise<LlmResponse>;
}

/** Token de injeção do provedor escolhido por LLM_PROVIDER. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export function textOf(content: LlmContentBlock[]): string {
  return content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}
