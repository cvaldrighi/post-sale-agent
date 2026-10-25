import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { resolveCorrelationId } from './logging';

/** O correlation ID da requisição (o pino-http guarda em req.id), para repassar a outros serviços. */
export const CorrelationId = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const id = context.switchToHttp().getRequest<IncomingMessage>().id;
  // O nosso genReqId sempre gera string; se não for, gera um novo em vez de mandar "[object Object]"
  return typeof id === 'string' ? id : resolveCorrelationId(undefined);
});
