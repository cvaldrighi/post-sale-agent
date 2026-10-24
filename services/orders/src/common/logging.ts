import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';

export const CORRELATION_HEADER = 'x-correlation-id';

// Aceita só IDs "comportados": evita que um header malicioso injete texto nos logs
const VALID_CORRELATION_ID = /^[A-Za-z0-9._-]{1,128}$/;

/** Usa o correlation ID recebido, se for válido; senão, gera um novo. */
export function resolveCorrelationId(header: unknown): string {
  return typeof header === 'string' && VALID_CORRELATION_ID.test(header) ? header : randomUUID();
}

/**
 * Configuração dos logs em JSON (pino):
 * - cada requisição recebe um correlation ID, devolvido no header da resposta;
 * - todas as linhas de log da requisição levam o campo `correlationId`;
 * - headers com segredos são substituídos por "[REDACTED]".
 */
export function buildLoggerParams(level: string): Params {
  return {
    pinoHttp: {
      level,
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const id = resolveCorrelationId(req.headers[CORRELATION_HEADER]);
        res.setHeader(CORRELATION_HEADER, id);
        return id;
      },
      customProps: (req: IncomingMessage) => ({ correlationId: req.id }),
      redact: {
        paths: ['req.headers["x-api-key"]', 'req.headers.authorization', 'req.headers.cookie'],
        censor: '[REDACTED]',
      },
    },
  };
}
