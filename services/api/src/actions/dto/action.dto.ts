import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ACTION_STATUSES, type ActionStatus, type PendingAction } from '../entities/pending-action.entity';

export class ActionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['refund'] })
  type: 'refund';

  @ApiProperty({ enum: ACTION_STATUSES })
  status: ActionStatus;

  @ApiProperty({ example: 'ord_1001' })
  orderId: string;

  @ApiProperty({ example: 18990, description: 'Valor em centavos' })
  amountCents: number;

  @ApiProperty({ example: 'Pedido atrasado' })
  reason: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  decidedAt: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, example: 'payment_not_refundable' })
  errorCode: string | null;

  @ApiPropertyOptional({ nullable: true, type: Object, description: 'Estorno criado no orders' })
  refund: unknown;
}

/** Resumo da ação que aguarda aprovação, devolvido junto com a resposta do assistente. */
export class PendingActionSummaryDto {
  @ApiProperty({ format: 'uuid', description: 'Use em POST /actions/{id}/approve ou /reject' })
  id: string;

  @ApiProperty({ enum: ['refund'] })
  type: 'refund';

  @ApiProperty({ example: 'ord_1001' })
  orderId: string;

  @ApiProperty({ example: 18990, description: 'Valor em centavos' })
  amountCents: number;

  @ApiProperty({ format: 'date-time' })
  expiresAt: string;
}

export function toPendingActionSummary(action: PendingAction): PendingActionSummaryDto {
  return {
    id: action.id,
    type: action.type,
    orderId: action.orderId,
    amountCents: action.amountCents,
    expiresAt: action.expiresAt.toISOString(),
  };
}

export function toActionResponse(action: PendingAction): ActionResponseDto {
  return {
    id: action.id,
    type: action.type,
    status: action.status,
    orderId: action.orderId,
    amountCents: action.amountCents,
    reason: action.reason,
    expiresAt: action.expiresAt.toISOString(),
    decidedAt: action.decidedAt?.toISOString() ?? null,
    errorCode: action.errorCode,
    refund: action.result ?? null,
  };
}
