import { TransientError, withRetry } from '../common/retry';
import { searchOutSchema, type SearchIn, type SearchResult } from './retrieval.schemas';

/**
 * Falha ao buscar no retrieval: o serviço não respondeu bem mesmo depois das tentativas, recusou a
 * chave ou devolveu algo fora do contrato. Para quem chama, todos os casos são "indisponível".
 */
export class RetrievalApiError extends Error {}

export interface RetrievalClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  attempts?: number;
  retryDelaysMs?: number[];
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (details: { path: string; attempt: number; reason: string }) => void;
}

/** Cliente HTTP do serviço retrieval (busca nas políticas da loja). */
export class RetrievalClient {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: RetrievalClientOptions) {
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * POST /search. Pode ser repetida: a busca só lê, não altera nada no retrieval.
   */
  async search(input: SearchIn, correlationId: string): Promise<SearchResult[]> {
    const path = '/search';
    try {
      return await withRetry(() => this.attempt(path, input, correlationId), {
        attempts: this.options.attempts ?? 3,
        delaysMs: this.options.retryDelaysMs ?? [200, 400],
        sleep: this.options.sleep,
        onRetry: (attempt, error) => this.options.onRetry?.({ path, attempt, reason: error.message }),
      });
    } catch (error) {
      if (error instanceof TransientError) {
        throw new RetrievalApiError(`retrieval indisponível: ${error.message}`);
      }
      throw error;
    }
  }

  /** Uma tentativa. Lança TransientError quando vale tentar de novo. */
  private async attempt(path: string, input: SearchIn, correlationId: string): Promise<SearchResult[]> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.options.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.options.apiKey,
          'x-correlation-id': correlationId,
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      // Tempo limite ou erro de rede: temporário
      throw new TransientError(error instanceof Error ? error.message : String(error));
    }

    if (response.status >= 500) throw new TransientError(`status ${response.status}`);
    if (!response.ok) {
      // 401, 400...: repetir não muda nada. É erro de configuração ou de uso.
      throw new RetrievalApiError(`status inesperado ${response.status} em ${path}`);
    }

    const parsed = searchOutSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new RetrievalApiError(`resposta fora do contrato em ${path}: ${parsed.error.message}`);
    }
    return parsed.data.results;
  }
}
