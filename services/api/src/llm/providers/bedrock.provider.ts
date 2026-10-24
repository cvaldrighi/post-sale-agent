import {
  BedrockRuntimeClient,
  ContentBlock,
  ConverseCommand,
  Message,
  StopReason,
  Tool,
  ToolUseBlock,
} from '@aws-sdk/client-bedrock-runtime';
import type {
  LlmContentBlock,
  LlmMessage,
  LlmProvider,
  LlmRequest,
  LlmResponse,
  LlmStopReason,
  LlmToolDefinition,
} from '../llm.types';

/** Tipo de "documento JSON" do SDK da AWS, obtido do próprio SDK para não depender de @smithy/types. */
type DocumentType = NonNullable<ToolUseBlock['input']>;

/**
 * Adaptador do Amazon Bedrock pela Converse API, que tem o mesmo formato para todos os modelos
 * do Bedrock. Credenciais pela cadeia padrão da AWS (AWS_PROFILE localmente, papel IAM em produção).
 */
export class BedrockProvider implements LlmProvider {
  readonly name = 'bedrock' as const;

  constructor(
    private readonly client: Pick<BedrockRuntimeClient, 'send'>,
    readonly model: string,
  ) {}

  async chat(request: LlmRequest, signal: AbortSignal): Promise<LlmResponse> {
    const output = await this.client.send(
      new ConverseCommand({
        modelId: this.model,
        system: [{ text: request.system }],
        messages: normalizeTurns(request.messages).map(toBedrockMessage),
        inferenceConfig: { maxTokens: request.maxTokens, temperature: 0.2 },
        ...(request.tools?.length ? { toolConfig: { tools: request.tools.map(toBedrockTool) } } : {}),
      }),
      { abortSignal: signal },
    );

    return {
      content: (output.output?.message?.content ?? []).flatMap(fromBedrockBlock),
      stopReason: mapStopReason(output.stopReason),
      usage: {
        inputTokens: output.usage?.inputTokens ?? 0,
        outputTokens: output.usage?.outputTokens ?? 0,
      },
      model: this.model,
    };
  }
}

/**
 * A Converse API exige que a conversa comece pelo usuário e alterne os papéis.
 * Isso pode não valer no histórico (ex.: duas mensagens do cliente seguidas depois de uma
 * falha da LLM, ou a janela de 20 começando numa resposta do assistente).
 */
export function normalizeTurns(messages: LlmMessage[]): LlmMessage[] {
  const firstUser = messages.findIndex((m) => m.role === 'user');
  if (firstUser === -1) return [];

  const turns: LlmMessage[] = [];
  for (const message of messages.slice(firstUser)) {
    const previous = turns.at(-1);
    if (previous && previous.role === message.role) {
      previous.content = [...previous.content, ...message.content];
    } else {
      turns.push({ role: message.role, content: [...message.content] });
    }
  }
  return turns;
}

function toBedrockMessage(message: LlmMessage): Message {
  return { role: message.role, content: message.content.map(toBedrockBlock) };
}

function toBedrockBlock(block: LlmContentBlock): ContentBlock {
  switch (block.type) {
    case 'text':
      return { text: block.text };
    case 'tool_use':
      return {
        toolUse: { toolUseId: block.id, name: block.name, input: block.input as DocumentType },
      };
    case 'tool_result':
      return {
        toolResult: {
          toolUseId: block.toolUseId,
          content: [
            typeof block.content === 'string'
              ? { text: block.content }
              : { json: block.content as DocumentType },
          ],
          status: block.isError ? 'error' : 'success',
        },
      };
  }
}

function toBedrockTool(tool: LlmToolDefinition): Tool {
  return {
    toolSpec: {
      name: tool.name,
      description: tool.description,
      inputSchema: { json: tool.inputSchema as DocumentType },
    },
  };
}

function fromBedrockBlock(block: ContentBlock): LlmContentBlock[] {
  if (block.text !== undefined) return [{ type: 'text', text: block.text }];
  if (block.toolUse) {
    return [
      {
        type: 'tool_use',
        id: block.toolUse.toolUseId ?? '',
        name: block.toolUse.name ?? '',
        input: (block.toolUse.input ?? {}) as Record<string, unknown>,
      },
    ];
  }
  return []; // outros tipos (ex.: raciocínio interno) não são usados aqui
}

function mapStopReason(reason: StopReason | undefined): LlmStopReason {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'end_turn';
    case 'tool_use':
      return 'tool_use';
    case 'max_tokens':
      return 'max_tokens';
    default:
      return 'other';
  }
}
