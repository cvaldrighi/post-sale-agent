import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { SimulationInterceptor } from './simulation.interceptor';

function contextWithHeader(value: string): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ header: () => value }) }),
  } as unknown as ExecutionContext;
}

function interceptor(enabled: boolean): SimulationInterceptor {
  const values: Record<string, unknown> = {
    ORDERS_SIMULATION_ENABLED: enabled,
    ORDERS_SIMULATED_DELAY_MS: 10,
  };
  const config = { get: (key: string) => values[key] } as unknown as ConfigService;
  return new SimulationInterceptor(new Reflector(), config as never);
}

const next: CallHandler = { handle: () => of('real response') };

describe('SimulationInterceptor', () => {
  it('ignores x-simulate when the simulation is disabled', async () => {
    const result = interceptor(false).intercept(contextWithHeader('error'), next);

    await expect(firstValueFrom(result)).resolves.toBe('real response');
  });

  it('fails with simulated_failure when enabled and x-simulate is error', () => {
    let error: unknown;
    try {
      interceptor(true).intercept(contextWithHeader('error'), next);
    } catch (e) {
      error = e;
    }

    expect(error).toMatchObject({ code: 'simulated_failure' });
  });

  it('delays and then answers normally when x-simulate is slow', async () => {
    const started = Date.now();
    const result = interceptor(true).intercept(contextWithHeader('slow'), next);

    await expect(firstValueFrom(result)).resolves.toBe('real response');
    expect(Date.now() - started).toBeGreaterThanOrEqual(10);
  });
});
