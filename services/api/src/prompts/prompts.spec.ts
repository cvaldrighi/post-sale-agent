import { ASSISTANT_PROMPT_VERSION, loadPrompt } from './prompts';

describe('loadPrompt', () => {
  it('loads the assistant prompt with its version', () => {
    const prompt = loadPrompt(ASSISTANT_PROMPT_VERSION);

    expect(prompt.version).toBe('assistant-v1');
    expect(prompt.text).toContain('assistente de pós-venda');
  });

  it('fails for a version that does not exist', () => {
    expect(() => loadPrompt('assistant-v999')).toThrow();
  });
});
