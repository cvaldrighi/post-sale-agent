/**
 * Ações afirmadas precisam ter acontecido: a resposta não pode dizer que preparou, solicitou ou fez
 * um estorno se a ferramenta request_refund não teve sucesso nesta mensagem.
 *
 * Caso real (teste manual da change add-action-grounding): sem chamar ferramenta nenhuma, o modelo
 * respondeu "Preparei a solicitação de estorno de R$ 189,90 do pedido ord_1001". Nenhuma proposta
 * existia, e o cliente ficaria esperando algo que não existe.
 *
 * A primeira versão só olhava o passado ("preparei"); na avaliação, o modelo escreveu "Preparando a
 * solicitação… depois que você aprovar a solicitação" sem chamar a ferramenta, e passou.
 *
 * Limitação: frases fora destes padrões passam. O sinal confiável é o pendingAction da resposta,
 * que vem do banco e não do texto da LLM.
 */

export const UNGROUNDED_ACTION_REPLY =
  'Ainda não consegui preparar a solicitação de estorno. Pode me confirmar o número do pedido para ' +
  'eu tentar de novo?';

// Verbos que afirmam a ação: passado ("preparei") e gerúndio ("preparando", visto na avaliação).
// O infinitivo ("posso preparar") não é afirmação e passa.
const DONE_VERBS =
  'preparei|criei|registrei|gerei|abri|fiz|solicitei|enviei|efetuei|realizei|' +
  'preparando|criando|registrando|gerando|solicitando|enviando';

// Particípios: "a solicitação de estorno foi criada"
const CREATED = 'criad|preparad|registrad|enviad|abert';

// O texto é normalizado antes (minúsculas, sem acentos)
const CLAIMS = [
  // "preparei a solicitação de estorno", "solicitei o estorno", "fiz o estorno"
  new RegExp(`\\b(${DONE_VERBS})\\b.{0,40}\\bestorno\\b`),
  // "a solicitação de estorno foi criada"
  new RegExp(`\\b(solicitacao|pedido|proposta) de estorno\\b.{0,20}\\b(foi|esta) (${CREATED})[ao]\\b`),
  // "depois que você aprovar a solicitação": só faz sentido se a proposta existir
  /\b(aprovar|aprove|aprovacao d)a? (a )?solicitacao\b/,
];

export function isUngroundedActionClaim(reply: string, successfulTools: ReadonlySet<string>): boolean {
  if (successfulTools.has('request_refund')) return false;
  const normalized = reply.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return CLAIMS.some((claim) => claim.test(normalized));
}
