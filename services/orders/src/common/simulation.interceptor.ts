import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, switchMap, timer } from 'rxjs';
import type { EnvironmentVariables } from '../config/env.validation';
import { ProblemException } from './problem';
import { IS_PUBLIC } from './public.decorator';

/**
 * Simula falhas de um sistema externo para quem consome este serviço testar
 * timeout e retry. Controlado pelo header `x-simulate` e só ativo quando
 * ORDERS_SIMULATION_ENABLED=true.
 */
@Injectable()
export class SimulationInterceptor implements NestInterceptor {
  private readonly enabled: boolean;
  private readonly delayMs: number;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.enabled = config.get('ORDERS_SIMULATION_ENABLED', { infer: true });
    this.delayMs = config.get('ORDERS_SIMULATED_DELAY_MS', { infer: true });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!this.enabled || isPublic) return next.handle();

    const mode = context.switchToHttp().getRequest<Request>().header('x-simulate');

    if (mode === 'error') {
      throw new ProblemException(
        'simulated_failure',
        HttpStatus.SERVICE_UNAVAILABLE,
        'Falha simulada pelo header x-simulate',
      );
    }
    if (mode === 'slow') {
      return timer(this.delayMs).pipe(switchMap(() => next.handle()));
    }
    return next.handle();
  }
}
