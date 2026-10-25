import { z } from 'zod';
import type { LlmToolDefinition } from '../../llm/llm.types';

/** Dados da requisição que as ferramentas recebem por fora da LLM (nunca como parâmetro). */
export interface ToolContext {
  conversationId: string;
  /** Do token. É a única fonte da identidade do cliente. */
  customerId: string;
  correlationId: string;
}

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; code: string; message: string; outcome: 'error' | 'denied' };

export interface AgentTool<Input extends z.ZodType = z.ZodType> {
  name: string;
  /** Lida pela LLM para decidir quando usar a ferramenta. */
  description: string;
  /** Fonte única: gera o JSON Schema enviado à LLM e valida o que ela mandar. */
  input: Input;
  execute(input: z.infer<Input>, context: ToolContext): Promise<ToolResult>;
}

export function defineTool<Input extends z.ZodType>(tool: AgentTool<Input>): AgentTool {
  return tool as unknown as AgentTool;
}

/** Ferramentas disponíveis para o agente. */
export class ToolRegistry {
  private readonly tools: Map<string, AgentTool>;

  constructor(tools: AgentTool[]) {
    this.tools = new Map(tools.map((tool) => [tool.name, tool]));
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  names(): string[] {
    return [...this.tools.keys()];
  }

  definitions(): LlmToolDefinition[] {
    return [...this.tools.values()].map((tool) => {
      const { $schema: _ignored, ...inputSchema } = z.toJSONSchema(tool.input) as Record<string, unknown>;
      return { name: tool.name, description: tool.description, inputSchema };
    });
  }
}
