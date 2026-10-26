import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { MoreThan, Repository } from 'typeorm';
import { formatBrl } from '../common/money';
import { ProblemException } from '../common/problem';
import { Message } from '../conversations/entities/message.entity';
import { OrdersApiError, OrdersClient } from '../orders-client/orders.client';
import type { Refund } from '../orders-client/orders.schemas';
import { PendingAction, type ActionStatus } from './entities/pending-action.entity';

/** Por quanto tempo o cliente pode aprovar uma proposta. */
export const ACTION_TTL_MS = 15 * 60 * 1000;

export interface RefundProposal {
  conversationId: string;
  customerId: string;
  orderId: string;
  amountCents: number;
  reason: string;
}

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(PendingAction) private readonly actions: Repository<PendingAction>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly orders: OrdersClient,
    @InjectPinoLogger(ActionsService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Cria a proposta de estorno, ou devolve a que já está pendente e válida para o mesmo pedido NA
   * MESMA CONVERSA. Numa conversa nova, cria outra: a resposta de cada conversa mostra a proposta
   * que o cliente pode aprovar ali, e a mensagem com o resultado vai para a conversa certa. Se o
   * cliente aprovar as duas, o orders recusa a segunda (não sobra valor para estornar).
   * Não chama o orders: quem executa é a aprovação.
   */
  async proposeRefund(proposal: RefundProposal): Promise<PendingAction> {
    const existing = await this.actions.findOne({
      where: {
        conversationId: proposal.conversationId,
        customerId: proposal.customerId,
        orderId: proposal.orderId,
        type: 'refund',
        status: 'pending',
      },
      order: { createdAt: 'DESC' },
    });
    if (existing && existing.expiresAt.getTime() > Date.now()) return existing;

    return this.actions.save(
      this.actions.create({
        ...proposal,
        type: 'refund',
        status: 'pending',
        expiresAt: new Date(Date.now() + ACTION_TTL_MS),
      }),
    );
  }

  /**
   * Executa a ação, uma única vez:
   * 1. pending → executing numa operação condicional (dois cliques: só um muda a linha)
   * 2. POST /refunds com o id da ação como Idempotency-Key
   * 3. executing → executed/failed; se o orders estiver fora, volta para pending
   */
  async approve(id: string, customerId: string, correlationId: string): Promise<PendingAction> {
    const claimed = await this.transition(id, customerId, 'executing', { requireValid: true });
    if (!claimed) throw await this.whyNot(id, customerId);

    const action = await this.actions.findOneByOrFail({ id });
    let refund: Refund;
    try {
      refund = await this.orders.createRefund(
        { orderId: action.orderId, amountCents: action.amountCents, reason: action.reason },
        action.id,
        correlationId,
      );
    } catch (error) {
      return this.handleExecutionError(action, error);
    }

    await this.actions.update({ id }, { status: 'executed', result: refund, errorCode: null });
    const situation = refund.status === 'completed' ? 'concluído' : 'em processamento';
    await this.addAssistantMessage(
      action,
      `Estorno de ${formatBrl(refund.amountCents)} do pedido ${action.orderId} ${situation}.`,
    );
    this.logger.info({ actionId: id, orderId: action.orderId, refundId: refund.id }, 'Refund executed');
    return this.actions.findOneByOrFail({ id });
  }

  async reject(id: string, customerId: string): Promise<PendingAction> {
    const changed = await this.transition(id, customerId, 'rejected', { requireValid: false });
    if (!changed) throw await this.whyNot(id, customerId);

    const action = await this.actions.findOneByOrFail({ id });
    this.logger.info({ actionId: id, orderId: action.orderId }, 'Action rejected by the customer');
    return action;
  }

  /** A ação pendente e ainda válida mais recente da conversa (o que o cliente pode aprovar agora). */
  findPendingForConversation(conversationId: string): Promise<PendingAction | null> {
    return this.actions.findOne({
      where: { conversationId, status: 'pending', expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
  }

  /** Busca a ação SÓ se for do cliente (mesma regra das conversas). */
  async getOwned(id: string, customerId: string): Promise<PendingAction> {
    const action = isUUID(id) ? await this.actions.findOneBy({ id, customerId }) : null;
    if (!action) throw new ProblemException('action_not_found', HttpStatus.NOT_FOUND);
    return action;
  }

  /**
   * Muda pending → `to` só se a ação for do cliente e ainda estiver pending (e válida, se pedido).
   * É um único UPDATE: o Postgres garante que, entre duas requisições simultâneas, só uma muda a linha.
   */
  private async transition(
    id: string,
    customerId: string,
    to: ActionStatus,
    { requireValid }: { requireValid: boolean },
  ): Promise<boolean> {
    if (!isUUID(id)) return false;
    const query = this.actions
      .createQueryBuilder()
      .update(PendingAction)
      .set({ status: to, decidedAt: () => 'now()' })
      .where('id = :id AND customer_id = :customerId AND status = :pending', {
        id,
        customerId,
        pending: 'pending',
      });
    if (requireValid) query.andWhere('expires_at > now()');
    const result = await query.execute();
    return result.affected === 1;
  }

  /** O UPDATE não mudou nada: descobre o motivo para responder o erro certo. */
  private async whyNot(id: string, customerId: string): Promise<ProblemException> {
    const action = await this.getOwned(id, customerId); // lança 404 se não for do cliente
    if (action.status === 'pending') {
      return new ProblemException(
        'action_expired',
        HttpStatus.CONFLICT,
        'Peça uma nova proposta ao assistente.',
      );
    }
    return new ProblemException('action_not_pending', HttpStatus.CONFLICT, `A ação está ${action.status}.`);
  }

  private async handleExecutionError(action: PendingAction, error: unknown): Promise<PendingAction> {
    if (error instanceof OrdersApiError && error.kind === 'unavailable') {
      // Nada foi estornado com certeza? Não importa: a nova aprovação usa a mesma Idempotency-Key
      await this.actions.update({ id: action.id }, { status: 'pending', decidedAt: null });
      this.logger.warn({ actionId: action.id, err: error }, 'Orders unavailable; action back to pending');
      throw new ProblemException(
        'orders_unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
        'Não foi possível fazer o estorno agora. Tente aprovar novamente em alguns minutos.',
      );
    }
    if (error instanceof OrdersApiError) {
      // rejected (409/422) ou not_found: regra de negócio, a ação termina aqui
      const code = error.kind === 'not_found' ? 'order_not_found' : (error.code ?? 'refund_rejected');
      await this.actions.update({ id: action.id }, { status: 'failed', errorCode: code });
      await this.addAssistantMessage(
        action,
        `Não foi possível fazer o estorno do pedido ${action.orderId} (${code}). Fale com o atendimento.`,
      );
      this.logger.warn({ actionId: action.id, errorCode: code }, 'Refund rejected by orders');
      return this.actions.findOneByOrFail({ id: action.id });
    }
    // Erro inesperado: a ação fica executing (ver "Em produção" no design) e o filtro responde 500
    throw error;
  }

  /** Mensagem montada pelo código, não pela LLM: o histórico mostra o que aconteceu de fato. */
  private async addAssistantMessage(action: PendingAction, content: string): Promise<void> {
    await this.messages.save(
      this.messages.create({ conversationId: action.conversationId, role: 'assistant', content }),
    );
  }
}
