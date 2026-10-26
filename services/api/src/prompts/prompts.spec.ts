import { ASSISTANT_PROMPT_VERSION, loadPrompt } from './prompts';

describe('loadPrompt', () => {
  it('loads the current assistant prompt with its version', () => {
    const prompt = loadPrompt(ASSISTANT_PROMPT_VERSION);

    expect(prompt.version).toBe(ASSISTANT_PROMPT_VERSION);
    expect(prompt.text).toContain('assistente de pós-venda');
  });

  it.each(['assistant-v1', 'assistant-v2', 'assistant-v3', 'assistant-v4', 'assistant-v5', 'assistant-v6'])(
    'keeps the previous version %s available for comparison',
    (version) => {
      expect(loadPrompt(version).text.length).toBeGreaterThan(0);
    },
  );

  it('fails for a version that does not exist', () => {
    expect(() => loadPrompt('assistant-v999')).toThrow();
  });
});
