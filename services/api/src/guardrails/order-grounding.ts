/**
 * Pedidos citados na resposta precisam ter vindo de algum lugar confiável: o resultado de uma
 * ferramenta nesta mensagem ou o histórico da conversa (inclusive o que o próprio cliente digitou,
 * como em "não encontrei o pedido ord_2001").
 *
 * Achado da avaliação (prompt assistant-v7): sem chamar ferramenta nenhuma, o modelo respondeu
 * "Listei seus pedidos recentes: ord_1005, R$ 150,00…", pedidos que não existem.
 */

export const UNGROUNDED_ORDER_REPLY =
  'Não consegui confirmar os dados dos seus pedidos agora. Pode tentar de novo ou me dizer o ' +
  'número do pedido?';

const ORDER_ID = /\bord_[a-z0-9]+\b/gi;

/** Os ids de pedido citados na resposta que não aparecem em nenhuma fonte confiável. */
export function findUngroundedOrderIds(reply: string, trustedSources: string[]): string[] {
  const known = new Set(trustedSources.flatMap((source) => source.match(ORDER_ID) ?? []).map(lower));
  const cited = new Set((reply.match(ORDER_ID) ?? []).map(lower));
  return [...cited].filter((id) => !known.has(id));
}

const lower = (id: string) => id.toLowerCase();
