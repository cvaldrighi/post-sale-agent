/**
 * Retry com espera crescente, só para falhas temporárias.
 *
 * Regra: repetir só o que pode dar certo na próxima tentativa (tempo limite, rede, 5xx).
 * Um 404 ou 400 vai dar o mesmo resultado sempre; repetir só atrasa a resposta.
 * Usado apenas em consultas (GET): repetir uma escrita poderia duplicar o efeito.
 */

/** Erro que vale a pena tentar de novo. */
export class TransientError extends Error {}

export interface RetryOptions {
  attempts: number;
  /** Espera antes de cada nova tentativa, em ms (ex.: [200, 400]). */
  delaysMs: number[];
  /** Chamado a cada falha temporária, para registrar no log. */
  onRetry?: (attempt: number, error: TransientError) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isLastAttempt = attempt >= options.attempts;
      if (!(error instanceof TransientError) || isLastAttempt) throw error;

      options.onRetry?.(attempt, error);
      await sleep(options.delaysMs[attempt - 1] ?? options.delaysMs.at(-1) ?? 0);
    }
  }
}
