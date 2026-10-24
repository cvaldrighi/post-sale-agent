import { HttpException, HttpStatus } from '@nestjs/common';

/** Códigos de erro do contrato (`Problem.code` em contracts/orders.yaml). */
export type ProblemCode =
  | 'unauthorized'
  | 'validation_error'
  | 'idempotency_key_required'
  | 'idempotency_key_reused'
  | 'order_not_found'
  | 'payment_not_refundable'
  | 'amount_exceeds_refundable'
  | 'simulated_failure'
  | 'service_unavailable'
  | 'not_found'
  | 'internal_error';

const TITLES: Record<ProblemCode, string> = {
  unauthorized: 'Chave de API ausente ou inválida',
  validation_error: 'Requisição inválida',
  idempotency_key_required: 'Header Idempotency-Key obrigatório',
  idempotency_key_reused: 'Idempotency-Key já usada com outro corpo',
  order_not_found: 'Pedido não encontrado',
  payment_not_refundable: 'Pagamento não pode ser estornado',
  amount_exceeds_refundable: 'Valor acima do estornável',
  simulated_failure: 'Falha simulada',
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

/** Exceção que já carrega o código de erro do contrato. */
export class ProblemException extends HttpException {
  constructor(
    readonly code: ProblemCode,
    status: HttpStatus,
    readonly detail?: string,
  ) {
    super(buildProblem(code, status, detail), status);
  }
}
