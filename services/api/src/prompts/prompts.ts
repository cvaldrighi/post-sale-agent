import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Prompt {
  /** Identificador registrado em cada chamada à LLM, para comparar versões. */
  version: string;
  text: string;
}

/**
 * Carrega um prompt versionado de src/prompts/<version>.md.
 * Mudar o comportamento do assistente = criar uma nova versão, não editar a antiga.
 */
export function loadPrompt(version: string): Prompt {
  const text = readFileSync(join(__dirname, `${version}.md`), 'utf8').trim();
  return { version, text };
}

export const ASSISTANT_PROMPT_VERSION = 'assistant-v3';
