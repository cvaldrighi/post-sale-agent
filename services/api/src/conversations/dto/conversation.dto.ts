import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { PendingActionSummaryDto } from '../../actions/dto/action.dto';

export class SendMessageDto {
  @ApiProperty({ example: 'Meu pedido ord_1001 atrasou. Posso cancelar?', minLength: 1, maxLength: 4000 })
  @IsString()
  @Length(1, 4000)
  content: string;
}

export class MessageResponseDto {
  @ApiProperty({ example: '42' })
  id: string;

  @ApiProperty({ enum: ['user', 'assistant'] })
  role: 'user' | 'assistant';

  @ApiProperty()
  content: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class SendMessageResponseDto extends MessageResponseDto {
  @ApiProperty({
    type: PendingActionSummaryDto,
    nullable: true,
    description: 'Ação proposta pelo assistente que aguarda a aprovação do cliente',
  })
  pendingAction: PendingActionSummaryDto | null;
}

export class ConversationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class ConversationDetailDto extends ConversationResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  messages: MessageResponseDto[];
}
