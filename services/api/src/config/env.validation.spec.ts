import { validateEnv } from './env.validation';

const validEnv = {
  DATABASE_PASSWORD: 'secret',
  JWT_SECRET: 'x'.repeat(32),
  ORDERS_API_KEY: 'k'.repeat(16),
  RETRIEVAL_API_KEY: 'r'.repeat(16),
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
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
  });

  it('fails without ORDERS_API_KEY', () => {
    expect(() => validateEnv({ ...validEnv, ORDERS_API_KEY: undefined })).toThrow(/ORDERS_API_KEY/);
  });

  it('applies the agent and orders defaults', () => {
    const env = validateEnv(validEnv);

    expect(env.AGENT_MAX_STEPS).toBe(5);
    expect(env.ORDERS_TIMEOUT_MS).toBe(3000);
  });

  it('fails without RETRIEVAL_API_KEY', () => {
    expect(() => validateEnv({ ...validEnv, RETRIEVAL_API_KEY: undefined })).toThrow(/RETRIEVAL_API_KEY/);
  });

  it('fails with a RETRIEVAL_API_KEY shorter than 16 characters', () => {
    expect(() => validateEnv({ ...validEnv, RETRIEVAL_API_KEY: 'short' })).toThrow(/RETRIEVAL_API_KEY/);
  });

  it('applies the retrieval defaults', () => {
    const env = validateEnv(validEnv);

    expect(env.RETRIEVAL_BASE_URL).toBe('http://localhost:8000');
    expect(env.RETRIEVAL_TIMEOUT_MS).toBe(5000);
  });

  it('fails with a JWT_SECRET shorter than 32 characters', () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
});
