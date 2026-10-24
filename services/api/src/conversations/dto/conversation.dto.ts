import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

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
