/**
 * Mascaramento de dados pessoais na mensagem do cliente, antes de gravar e de enviar à LLM.
 * O texto original não é guardado: dado que não existe não vaza.
 */

export interface MaskResult {
  text: string;
  /** Quantos de cada tipo foram mascarados (para o log, sem o conteúdo). */
  counts: { cpf: number; card: number };
}

// 13 a 19 dígitos, que podem vir separados por espaço ou hífen ("4111 1111 1111 1111")
const CARD_CANDIDATE = /\b\d(?:[ -]?\d){12,18}\b/g;
// "123.456.789-09" ou 11 dígitos seguidos
const CPF = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g;

export function maskPii(text: string): MaskResult {
  const counts = { cpf: 0, card: 0 };

  // Cartão primeiro: um cartão de 16 dígitos não pode virar "CPF + 5 dígitos"
  const withoutCards = text.replace(CARD_CANDIDATE, (candidate) => {
    if (!passesLuhn(candidate.replace(/\D/g, ''))) return candidate; // telefone, protocolo...
    counts.card++;
    return '[CARTÃO]';
  });

  const masked = withoutCards.replace(CPF, () => {
    counts.cpf++;
    return '[CPF]';
  });

  return { text: masked, counts };
}

/**
 * Algoritmo de Luhn (dígito verificador dos cartões): da direita para a esquerda, dobra um dígito
 * sim, outro não (subtraindo 9 se passar de 9); o total precisa ser múltiplo de 10.
 */
export function passesLuhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}
