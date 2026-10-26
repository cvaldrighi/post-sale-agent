import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ActionsService } from '../actions/actions.service';
import { toPendingActionSummary } from '../actions/dto/action.dto';
import { CurrentCustomer } from '../auth/current-customer.decorator';
import { CorrelationId } from '../common/correlation-id.decorator';
import { ConversationsService } from './conversations.service';
import {
  ConversationDetailDto,
  ConversationResponseDto,
  MessageResponseDto,
  SendMessageDto,
  SendMessageResponseDto,
} from './dto/conversation.dto';
import type { Conversation } from './entities/conversation.entity';
import type { Message } from './entities/message.entity';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly actions: ActionsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Abre uma conversa para o cliente do token' })
  @ApiCreatedResponse({ type: ConversationResponseDto })
  async create(@CurrentCustomer() customerId: string): Promise<ConversationResponseDto> {
    return toConversation(await this.conversations.create(customerId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta uma conversa do cliente com todas as mensagens' })
  @ApiOkResponse({ type: ConversationDetailDto })
  async get(
    @Param('id') id: string,
    @CurrentCustomer() customerId: string,
  ): Promise<ConversationDetailDto> {
    const conversation = await this.conversations.getOwned(id, customerId);
    const messages = await this.conversations.listMessages(conversation.id);
    return {
      id: conversation.id,
      createdAt: conversation.createdAt.toISOString(),
      messages: messages.map(toMessage),
    };
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Envia uma mensagem e recebe a resposta do assistente' })
  @ApiCreatedResponse({ type: SendMessageResponseDto })
  async sendMessage(
    @Param('id') id: string,
    @CurrentCustomer() customerId: string,
    @CorrelationId() correlationId: string,
    @Body() body: SendMessageDto,
  ): Promise<SendMessageResponseDto> {
    const reply = await this.conversations.sendMessage(id, customerId, body.content, correlationId);
    // A conversa já foi conferida como do cliente dentro do sendMessage
    const pending = await this.actions.findPendingForConversation(id);
    // toMessage já cria um objeto novo; Object.assign acrescenta o campo sem copiar com spread
    return Object.assign(toMessage(reply), {
      pendingAction: pending ? toPendingActionSummary(pending) : null,
    });
  }
}

function toConversation(conversation: Conversation): ConversationResponseDto {
  return { id: conversation.id, createdAt: conversation.createdAt.toISOString() };
}

function toMessage(message: Message): MessageResponseDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}
