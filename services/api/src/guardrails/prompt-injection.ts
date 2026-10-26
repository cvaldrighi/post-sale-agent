/**
 * Detecção de padrões conhecidos de injeção de prompt na mensagem do cliente.
 *
 * É uma camada fraca de propósito: uma lista de padrões é fácil de contornar. Ela barra o óbvio;
 * quem limita o dano são as regras no código (autorização, validações, aprovação do cliente).
 * Os padrões são específicos ("ignore as instruções anteriores", não "instruções") para não
 * bloquear perguntas legítimas.
 */

export const PROMPT_INJECTION_REPLY =
  'Não consigo atender esse pedido. Posso ajudar com seus pedidos, pagamentos, trocas, ' +
  'cancelamentos e estornos.';

/** "(?:a|b|c)": qualquer uma das palavras. */
const anyOf = (...words: string[]) => `(?:${words.join('|')})`;
/** As partes em sequência, com até `gap` caracteres entre elas, como palavras inteiras. */
const sequence = (gap: number, ...parts: string[]) =>
  new RegExp(parts.map((part) => `\\b${part}\\b`).join(`.{0,${gap}}`));

// O texto é normalizado antes (minúsculas, sem acentos), então as palavras não têm acento
const PATTERNS: { name: string; regex: RegExp }[] = [
  {
    // "ignore as instruções anteriores", "esqueça as regras do sistema"
    name: 'ignore_instructions',
    regex: sequence(
      30,
      anyOf('ignore', 'ignora', 'esqueca', 'desconsidere', 'desconsidera'),
      anyOf('instrucoes', 'regras', 'orientacoes', 'prompt'),
      anyOf('anteriores', 'acima', 'do sistema', 'que recebeu', 'recebidas'),
    ),
  },
  {
    name: 'ignore_instructions_en',
    regex: sequence(
      20,
      anyOf('ignore', 'disregard', 'forget'),
      anyOf('previous', 'prior', 'above', 'all'),
      anyOf('instructions', 'rules', 'prompt'),
    ),
  },
  {
    // "mostre o seu prompt", "repita as instruções do sistema"
    name: 'reveal_prompt',
    regex: sequence(
      30,
      anyOf('mostre', 'mostra', 'revele', 'revela', 'repita', 'repete', 'exiba', 'imprima'),
      anyOf('prompt', 'instrucoes do sistema', 'instrucoes iniciais'),
    ),
  },
  {
    name: 'reveal_prompt_en',
    regex: sequence(30, anyOf('show', 'reveal', 'print', 'repeat'), anyOf('prompt', 'system prompt')),
  },
  {
    name: 'role_change',
    regex: sequence(
      0,
      anyOf(
        'voce agora e',
        'a partir de agora voce e',
        'finja que voce e',
        'you are now',
        'act as',
        'pretend to be',
      ),
    ),
  },
  {
    name: 'developer_mode',
    regex: sequence(0, anyOf('modo desenvolvedor', 'developer mode', 'modo dan', 'jailbreak')),
  },
];

export interface InjectionCheck {
  detected: boolean;
  /** Nome do padrão encontrado, para o log (nunca o texto do cliente). */
  pattern?: string;
}

export function detectPromptInjection(text: string): InjectionCheck {
  const normalized = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tira os acentos: "instruções" → "instrucoes"
    .toLowerCase();

  const match = PATTERNS.find((pattern) => pattern.regex.test(normalized));
  return match ? { detected: true, pattern: match.name } : { detected: false };
}
