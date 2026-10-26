import type { z } from 'zod';
import {
  orderListSchema,
  orderSchema,
  paymentSchema,
  type Order,
  type OrderSummary,
  type Payment,
} from './orders.schemas';
import { TransientError, withRetry } from '../common/retry';

/**
 * Falha ao consultar o orders, já classificada para quem chama:
 * - not_found: o pedido não existe (404)
 * - unavailable: o serviço não respondeu bem mesmo depois das tentativas, recusou a chave
 *   ou devolveu algo fora do contrato
 */
export class OrdersApiError extends Error {
  constructor(
    readonly kind: 'not_found' | 'unavailable',
    message: string,
  ) {
    super(message);
  }
}

export interface OrdersClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  attempts?: number;
  retryDelaysMs?: number[];
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (details: { path: string; attempt: number; reason: string }) => void;
}

/** Cliente HTTP do serviço orders (um sistema "de terceiro"), só para consultas. */
export class OrdersClient {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: OrdersClientOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async listCustomerOrders(customerId: string, correlationId: string): Promise<OrderSummary[]> {
    const body = await this.get(
      `/customers/${encodeURIComponent(customerId)}/orders`,
      orderListSchema,
      correlationId,
    );
    return body.data;
  }

  getOrder(orderId: string, correlationId: string): Promise<Order> {
    return this.get(`/orders/${encodeURIComponent(orderId)}`, orderSchema, correlationId);
  }

  getPayment(orderId: string, correlationId: string): Promise<Payment> {
    return this.get(`/orders/${encodeURIComponent(orderId)}/payment`, paymentSchema, correlationId);
  }

  private async get<S extends z.ZodType>(
    path: string,
    schema: S,
    correlationId: string,
  ): Promise<z.infer<S>> {
    try {
      return await withRetry(() => this.attempt(path, schema, correlationId), {
        attempts: this.options.attempts ?? 3,
        delaysMs: this.options.retryDelaysMs ?? [200, 400],
        sleep: this.options.sleep,
        onRetry: (attempt, error) =>
          this.options.onRetry?.({ path, attempt, reason: error.message }),
      });
    } catch (error) {
      if (error instanceof TransientError) {
        throw new OrdersApiError('unavailable', `orders indisponível: ${error.message}`);
      }
      throw error;
    }
  }

  /** Uma tentativa. Lança TransientError quando vale tentar de novo. */
  private async attempt<S extends z.ZodType>(
    path: string,
    schema: S,
    correlationId: string,
  ): Promise<z.infer<S>> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.options.baseUrl}${path}`, {
        headers: { 'x-api-key': this.options.apiKey, 'x-correlation-id': correlationId },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      // Tempo limite ou erro de rede: temporário
      throw new TransientError(error instanceof Error ? error.message : String(error));
    }

    if (response.status >= 500) throw new TransientError(`status ${response.status}`);
    if (response.status === 404) throw new OrdersApiError('not_found', `${path} não encontrado`);
    if (!response.ok) {
      // 401, 400...: repetir não muda nada. É erro de configuração ou de uso.
      throw new OrdersApiError('unavailable', `status inesperado ${response.status} em ${path}`);
    }

    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      throw new OrdersApiError('unavailable', `resposta fora do contrato em ${path}: ${parsed.error.message}`);
    }
    return parsed.data;
  }
}
