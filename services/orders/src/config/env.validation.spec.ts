import { validateEnv } from './env.validation';

const validEnv = {
  DATABASE_PASSWORD: 'secret',
  ORDERS_API_KEY: 'a'.repeat(16),
};

describe('validateEnv', () => {
  it('applies defaults when optional variables are missing', () => {
    const env = validateEnv(validEnv);

    expect(env.PORT).toBe(3002);
    expect(env.DATABASE_USER).toBe('orders_service');
    expect(env.ORDERS_SIMULATION_ENABLED).toBe(false);
    expect(env.ORDERS_SIMULATED_DELAY_MS).toBe(5000);
  });

  it('converts numbers and booleans from strings', () => {
    const env = validateEnv({
      ...validEnv,
      PORT: '4000',
      ORDERS_SIMULATION_ENABLED: 'true',
      ORDERS_SIMULATED_DELAY_MS: '100',
    });

    expect(env.PORT).toBe(4000);
    expect(env.ORDERS_SIMULATION_ENABLED).toBe(true);
    expect(env.ORDERS_SIMULATED_DELAY_MS).toBe(100);
  });

  it('reads "false" as false', () => {
    const env = validateEnv({ ...validEnv, ORDERS_SIMULATION_ENABLED: 'false' });

    expect(env.ORDERS_SIMULATION_ENABLED).toBe(false);
  });

  it('fails without ORDERS_API_KEY', () => {
    expect(() => validateEnv({ DATABASE_PASSWORD: 'secret' })).toThrow(/ORDERS_API_KEY/);
  });

  it('fails with an API key shorter than 16 characters', () => {
    expect(() => validateEnv({ ...validEnv, ORDERS_API_KEY: 'short' })).toThrow(/ORDERS_API_KEY/);
  });

  it('fails without DATABASE_PASSWORD', () => {
    expect(() => validateEnv({ ORDERS_API_KEY: 'a'.repeat(16) })).toThrow(/DATABASE_PASSWORD/);
  });
});
