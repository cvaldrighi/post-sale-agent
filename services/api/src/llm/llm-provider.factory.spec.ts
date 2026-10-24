import { createLlmProvider } from './llm-provider.factory';

const base = { LLM_MODEL: 'model-x', OLLAMA_BASE_URL: 'http://localhost:11434', AWS_REGION: 'us-east-1' };

describe('createLlmProvider', () => {
  it('creates the Ollama provider', () => {
    const provider = createLlmProvider({ ...base, LLM_PROVIDER: 'ollama' });

    expect(provider.name).toBe('ollama');
    expect(provider.model).toBe('model-x');
  });

  it('creates the Bedrock provider', () => {
    expect(createLlmProvider({ ...base, LLM_PROVIDER: 'bedrock' }).name).toBe('bedrock');
  });
});
