/**
 * Checagem de fundamentação: resposta que cita uma política da loja precisa ter vindo de uma busca
 * nas políticas feita durante a mesma mensagem.
 *
 * Caso real (verificação manual da change add-policy-search-tool): sem chamar ferramenta nenhuma, o
 * modelo respondeu "Pela nossa Política de Devoluções, produtos personalizados não podem ser
 * devolvidos". Essa política não existe.
 *
 * Limitação conhecida: uma regra inventada sem a palavra "política" passa. A avaliação mede isso.
 */

export const UNGROUNDED_POLICY_REPLY =
  'Não encontrei essa regra nas políticas da loja. Para não passar uma informação errada, sugiro ' +
  'confirmar com o nosso atendimento.';

const MENTIONS_POLICY = /\bpol[ií]ticas?\b/i;

export function isUngroundedPolicyAnswer(reply: string, successfulTools: ReadonlySet<string>): boolean {
  return MENTIONS_POLICY.test(reply) && !successfulTools.has('search_policies');
}
