import { Body, Controller, Headers, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ProblemException } from '../common/problem';
import { CreateRefundDto } from './dto/create-refund.dto';
import type { Refund } from './entities/refund.entity';
import { RefundsService } from './refunds.service';

@Controller('refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Post()
  async create(
    @Body() body: CreateRefundDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!idempotencyKey) {
      throw new ProblemException('idempotency_key_required', HttpStatus.BAD_REQUEST);
    }
    if (idempotencyKey.length > 64) {
      throw new ProblemException(
        'validation_error',
        HttpStatus.BAD_REQUEST,
        'Idempotency-Key deve ter no máximo 64 caracteres',
      );
    }

    const { refund, replayed } = await this.refundsService.create(body, idempotencyKey);

    if (replayed) {
      res.status(HttpStatus.OK).setHeader('Idempotent-Replayed', 'true');
    } else {
      res.status(HttpStatus.CREATED);
    }
    return toRefundResponse(refund);
  }
}

function toRefundResponse(refund: Refund) {
  return {
    id: refund.id,
    orderId: refund.orderId,
    paymentId: refund.paymentId,
    amountCents: refund.amountCents,
    currency: refund.currency,
    reason: refund.reason,
    status: refund.status,
    createdAt: refund.createdAt.toISOString(),
  };
}
