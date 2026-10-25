import { z } from 'zod';
import { RetrievalApiError, type RetrievalClient } from '../../retrieval-client/retrieval.client';
import { defineTool, type AgentTool, type ToolResult } from './tool';

/** Quantos trechos vão para a LLM: o bastante para cobrir uma regra e suas exceções. */
export const POLICY_SEARCH_TOP_K = 4;

const NO_RESULTS = 'Nenhuma política da loja trata deste assunto.';
const UNAVAILABLE =
  'A consulta às políticas da loja está indisponível no momento. Tente novamente em alguns minutos.';

export function createPolicyTools(retrieval: RetrievalClient): AgentTool[] {
  return [
    defineTool({
      name: 'search_policies',
      description:
        'Busca nas políticas oficiais da loja: trocas, devoluções, cancelamento, estornos, prazos de ' +
        'entrega e garantia. Use sempre que a resposta depender de uma regra da loja. Escreva a busca ' +
        'com o assunto da pergunta, por exemplo "prazo do estorno no Pix".',
      input: z.object({
        query: z.string().trim().min(1).max(500).describe('O que buscar nas políticas'),
      }),
      async execute({ query }, context): Promise<ToolResult> {
        try {
          const results = await retrieval.search({ query, topK: POLICY_SEARCH_TOP_K }, context.correlationId);
          if (results.length === 0) return { ok: true, data: { results: [], message: NO_RESULTS } };

          return {
            ok: true,
            data: {
              // Só o que ajuda a responder e a citar a fonte; chunkId e score ficam de fora
              results: results.map((result) => ({
                policy: result.documentTitle,
                section: result.section,
                text: result.text,
              })),
            },
          };
        } catch (error) {
          if (error instanceof RetrievalApiError) {
            return { ok: false, code: 'policies_unavailable', message: UNAVAILABLE, outcome: 'error' };
          }
          throw error; // erro inesperado: o executor do agente trata
        }
      },
    }),
  ];
}
