import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { EnvironmentVariables } from '../config/env.validation';
import { ProblemException } from './problem';
import { IS_PUBLIC } from './public.decorator';

/**
 * Exige o header `x-api-key` em todas as rotas, exceto as marcadas com @Public().
 *
 * A comparação é feita em tempo constante: um `===` comum para no primeiro caractere
 * diferente, e medindo o tempo de resposta daria para descobrir a chave aos poucos.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly expectedDigest: Buffer;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.expectedDigest = digest(config.get('ORDERS_API_KEY', { infer: true }));
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const provided = context.switchToHttp().getRequest<Request>().header('x-api-key');
    // Hash dos dois lados: timingSafeEqual exige buffers do mesmo tamanho
    if (provided && timingSafeEqual(digest(provided), this.expectedDigest)) return true;

    throw new ProblemException('unauthorized', HttpStatus.UNAUTHORIZED);
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
