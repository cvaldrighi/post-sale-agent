import { HttpException, HttpStatus } from '@nestjs/common';

/** Códigos de erro estáveis da api (o consumidor decide pelo code, nunca pelo texto). */
export type ProblemCode =
  | 'unauthorized'
  | 'validation_error'
  | 'conversation_not_found'
  | 'llm_unavailable'
  | 'service_unavailable'
  | 'not_found'
  | 'internal_error';

const TITLES: Record<ProblemCode, string> = {
  unauthorized: 'Token ausente, inválido ou expirado',
  validation_error: 'Requisição inválida',
  conversation_not_found: 'Conversa não encontrada',
  llm_unavailable: 'Assistente indisponível no momento',
  service_unavailable: 'Serviço indisponível',
  not_found: 'Recurso não encontrado',
  internal_error: 'Erro interno',
};

/** Corpo de erro no formato problem+json (RFC 9457). */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code: ProblemCode;
}

export function buildProblem(code: ProblemCode, status: number, detail?: string): ProblemDetails {
  return {
    type: `https://post-sale-agent.dev/problems/${code.replace(/_/g, '-')}`,
    title: TITLES[code],
    status,
    ...(detail ? { detail } : {}),
    code,
  };
}

/** Exceção que já carrega o código de erro. */
export class ProblemException extends HttpException {
  constructor(
    readonly code: ProblemCode,
    status: HttpStatus,
    readonly detail?: string,
  ) {
    super(buildProblem(code, status, detail), status);
  }
}
