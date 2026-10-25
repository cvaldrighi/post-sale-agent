import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { ProblemException } from '../common/problem';
import type { EnvironmentVariables } from '../config/env.validation';
import { AgentService } from '../agent/agent.service';
import { LlmUnavailableError } from '../llm/llm.service';
import type { LlmMessage } from '../llm/llm.types';
import { ASSISTANT_PROMPT_VERSION, loadPrompt, type Prompt } from '../prompts/prompts';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';

@Injectable()
export class ConversationsService {
  private readonly prompt: Prompt = loadPrompt(ASSISTANT_PROMPT_VERSION);
  private readonly historyLimit: number;

  constructor(
    @InjectRepository(Conversation) private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly agent: AgentService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.historyLimit = config.get('LLM_HISTORY_LIMIT', { infer: true });
  }

  create(customerId: string): Promise<Conversation> {
    return this.conversations.save(this.conversations.create({ customerId }));
  }

  /**
   * Busca a conversa SÓ se ela for do cliente. Conversa de outro cliente e conversa
   * inexistente dão o mesmo erro, para não revelar que a conversa existe.
   */
  async getOwned(conversationId: string, customerId: string): Promise<Conversation> {
    // Um id que não é UUID faria o Postgres dar erro; para o cliente, é só "não encontrada"
    const conversation = isUUID(conversationId)
      ? await this.conversations.findOneBy({ id: conversationId, customerId })
      : null;
    if (!conversation) {
      throw new ProblemException('conversation_not_found', HttpStatus.NOT_FOUND);
    }
    return conversation;
  }

  listMessages(conversationId: string): Promise<Message[]> {
    return this.messages.find({ where: { conversationId }, order: { id: 'ASC' } });
  }

  async sendMessage(
    conversationId: string,
    customerId: string,
    content: string,
    correlationId: string,
  ): Promise<Message> {
    await this.getOwned(conversationId, customerId);

    // 1. A mensagem do cliente é gravada antes: se a LLM falhar, ela não se perde
    await this.messages.save(this.messages.create({ conversationId, role: 'user', content }));

    // 2. Janela de contexto: as N mais recentes, em ordem cronológica
    const recent = await this.messages.find({
      where: { conversationId },
      order: { id: 'DESC' },
      take: this.historyLimit,
    });
    const history: LlmMessage[] = recent.reverse().map((message) => ({
      role: message.role,
      content: [{ type: 'text', text: message.content }],
    }));

    // 3. O agente gera a resposta, usando ferramentas se precisar (fora de transação:
    //    pode levar dezenas de segundos). Só a resposta final vira mensagem.
    let reply: string;
    try {
      reply = await this.agent.run(
        { system: this.prompt.text, promptVersion: this.prompt.version, history },
        { conversationId, customerId, correlationId },
      );
    } catch (error) {
      if (error instanceof LlmUnavailableError) throw llmUnavailable();
      throw error;
    }

    // 4. Só agora a resposta do assistente é gravada
    return this.messages.save(
      this.messages.create({ conversationId, role: 'assistant', content: reply }),
    );
  }
}

function llmUnavailable(): ProblemException {
  return new ProblemException(
    'llm_unavailable',
    HttpStatus.SERVICE_UNAVAILABLE,
    'Não foi possível gerar a resposta agora. Tente novamente em instantes.',
  );
}
