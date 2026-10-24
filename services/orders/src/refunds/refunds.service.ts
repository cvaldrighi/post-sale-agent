import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { ProblemException } from '../common/problem';
import { Payment } from '../orders/entities/payment.entity';
import { orderNotFound } from '../orders/orders.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { Refund } from './entities/refund.entity';
import { decideRefund, requestHash } from './refund-rules';

export interface RefundResult {
  refund: Refund;
  /** true quando a mesma Idempotency-Key já tinha criado este estorno. */
  replayed: boolean;
}

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class RefundsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectPinoLogger(RefundsService.name) private readonly logger: PinoLogger,
  ) {}

  async create(body: CreateRefundDto, idempotencyKey: string): Promise<RefundResult> {
    const hash = requestHash(body);

    try {
      return await this.dataSource.transaction((manager) =>
        this.createInTransaction(manager, body, idempotencyKey, hash),
      );
    } catch (error) {
      // Mesma chave usada ao mesmo tempo para pedidos diferentes: a restrição UNIQUE do
      // banco barra a segunda gravação. Respondemos como uma repetição normal.
      if (isUniqueViolation(error)) {
        const existing = await this.dataSource.getRepository(Refund).findOneBy({ idempotencyKey });
        if (existing) return replay(existing, hash);
      }
      throw error;
    }
  }

  private async createInTransaction(
    manager: EntityManager,
    body: CreateRefundDto,
    idempotencyKey: string,
    hash: string,
  ): Promise<RefundResult> {
    // 1. Trava o pagamento (SELECT ... FOR UPDATE). Outra requisição para o mesmo
    //    pagamento espera aqui até esta transação terminar.
    const payment = await manager.findOne(Payment, {
      where: { orderId: body.orderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!payment) throw orderNotFound(body.orderId);

    // 2. Idempotência, verificada já com o lock: se uma requisição igual acabou de
    //    criar o estorno, nós o enxergamos aqui e devolvemos o mesmo.
    const existing = await manager.findOneBy(Refund, { idempotencyKey });
    if (existing) return replay(existing, hash);

    // 3. Regras de negócio (estado e valor)
    const decision = decideRefund(payment, body.amountCents);

    // 4. Grava o estorno e atualiza o pagamento na mesma transação
    const refund = await manager.save(
      manager.create(Refund, {
        orderId: body.orderId,
        paymentId: payment.id,
        amountCents: body.amountCents,
        currency: payment.currency,
        reason: body.reason,
        status: decision.refundStatus,
        idempotencyKey,
        requestHash: hash,
      }),
    );
    payment.refundedAmountCents = decision.refundedAmountCents;
    payment.status = decision.paymentStatus;
    await manager.save(payment);

    this.logger.info(
      { refundId: refund.id, orderId: refund.orderId, amountCents: refund.amountCents },
      'Refund created',
    );
    return { refund, replayed: false };
  }
}

function replay(existing: Refund, hash: string): RefundResult {
  if (existing.requestHash !== hash) {
    throw new ProblemException(
      'idempotency_key_reused',
      HttpStatus.UNPROCESSABLE_ENTITY,
      'Esta Idempotency-Key já foi usada com outro corpo',
    );
  }
  return { refund: existing, replayed: true };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code === UNIQUE_VIOLATION
  );
}
