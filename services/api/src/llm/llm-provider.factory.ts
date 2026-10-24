import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import type { EnvironmentVariables } from '../config/env.validation';
import type { LlmProvider } from './llm.types';
import { BedrockProvider } from './providers/bedrock.provider';
import { OllamaProvider } from './providers/ollama.provider';

type ProviderSettings = Pick<
  EnvironmentVariables,
  'LLM_PROVIDER' | 'LLM_MODEL' | 'OLLAMA_BASE_URL' | 'AWS_REGION'
>;

/** Escolhe a implementação pela configuração. Trocar de provedor = trocar uma variável. */
export function createLlmProvider(settings: ProviderSettings): LlmProvider {
  switch (settings.LLM_PROVIDER) {
    case 'ollama':
      return new OllamaProvider(settings.OLLAMA_BASE_URL, settings.LLM_MODEL);
    case 'bedrock':
      return new BedrockProvider(
        new BedrockRuntimeClient({ region: settings.AWS_REGION }),
        settings.LLM_MODEL,
      );
  }
}
