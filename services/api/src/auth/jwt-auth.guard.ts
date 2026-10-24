import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ProblemException } from '../common/problem';
import { IS_PUBLIC } from '../common/public.decorator';
import type { AuthenticatedRequest } from './current-customer.decorator';

/** Exige `Authorization: Bearer <token>` válido em todas as rotas, exceto as @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.header('authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();

    try {
      // Confere assinatura e validade (exp); lança erro se qualquer um falhar
      const payload = await this.jwt.verifyAsync<{ sub?: unknown }>(token);
      if (typeof payload.sub !== 'string') throw unauthorized();
      request.customerId = payload.sub;
      return true;
    } catch {
      throw unauthorized();
    }
  }
}

function unauthorized(): ProblemException {
  return new ProblemException('unauthorized', HttpStatus.UNAUTHORIZED);
}
