import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  customerId: string;
}

/** Injeta o customerId do token validado. Nunca vem do corpo nem da URL. */
export const CurrentCustomer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().customerId,
);
