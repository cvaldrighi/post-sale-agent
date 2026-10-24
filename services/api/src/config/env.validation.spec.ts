import { validateEnv } from './env.validation';

const validEnv = {
  DATABASE_PASSWORD: 'secret',
  JWT_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults when optional variables are missing', () => {
    const env = validateEnv(validEnv);

    expect(env.PORT).toBe(3000);
    expect(env.DATABASE_USER).toBe('app_service');
    expect(env.LLM_PROVIDER).toBe('ollama');
    expect(env.LLM_HISTORY_LIMIT).toBe(20);
  });

  it('accepts bedrock as provider', () => {
    expect(validateEnv({ ...validEnv, LLM_PROVIDER: 'bedrock' }).LLM_PROVIDER).toBe('bedrock');
  });

  it('fails with an unknown LLM_PROVIDER', () => {
    expect(() => validateEnv({ ...validEnv, LLM_PROVIDER: 'openai' })).toThrow(/LLM_PROVIDER/);
  });

  it('fails without JWT_SECRET', () => {
    expect(() => validateEnv({ DATABASE_PASSWORD: 'secret' })).toThrow(/JWT_SECRET/);
  });

  it('fails with a JWT_SECRET shorter than 32 characters', () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
});
