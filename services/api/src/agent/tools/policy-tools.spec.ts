import { RetrievalApiError, type RetrievalClient } from '../../retrieval-client/retrieval.client';
import type { SearchIn } from '../../retrieval-client/retrieval.schemas';
import { createPolicyTools } from './policy-tools';
import { ToolRegistry, type ToolContext } from './tool';

const context: ToolContext = { conversationId: 'conv-1', customerId: 'cust_001', correlationId: 'corr-1' };

const pixRule = {
  chunkId: 6,
  source: 'estornos',
  documentTitle: 'Política de Estornos',
  section: 'Política de Estornos > Prazo para Pix',
  text: 'O dinheiro volta para a conta de origem em até 1 dia útil.',
  score: 0.016393,
};

function searchPolicies(search: RetrievalClient['search']) {
  return new ToolRegistry(createPolicyTools({ search } as RetrievalClient)).get('search_policies')!;
}

describe('search_policies', () => {
  it('returns policy, section and text, without internal ids or scores', async () => {
    const calls: { input: SearchIn; correlationId: string }[] = [];
    const tool = searchPolicies(async (input, correlationId) => {
      calls.push({ input, correlationId });
      return [pixRule];
    });

    const result = await tool.execute({ query: 'prazo do estorno no Pix' }, context);

    expect(result).toEqual({
      ok: true,
      data: {
        results: [
          {
            policy: 'Política de Estornos',
            section: 'Política de Estornos > Prazo para Pix',
            text: 'O dinheiro volta para a conta de origem em até 1 dia útil.',
          },
        ],
      },
    });
    expect(calls).toEqual([
      { input: { query: 'prazo do estorno no Pix', topK: 4 }, correlationId: 'corr-1' },
    ]);
  });

  it('says that no policy covers the subject when nothing is found', async () => {
    const result = await searchPolicies(async () => []).execute({ query: 'produto personalizado' }, context);

    expect(result).toEqual({
      ok: true,
      data: { results: [], message: 'Nenhuma política da loja trata deste assunto.' },
    });
  });

  it('returns policies_unavailable when the retrieval fails', async () => {
    const tool = searchPolicies(async () => {
      throw new RetrievalApiError('retrieval indisponível: status 503');
    });

    await expect(tool.execute({ query: 'trocas' }, context)).resolves.toMatchObject({
      ok: false,
      code: 'policies_unavailable',
      outcome: 'error',
    });
  });

  it('rejects an empty query before calling the retrieval', () => {
    const tool = searchPolicies(async () => [pixRule]);

    // O AgentService valida com este schema antes de executar: entrada inválida nem chega ao execute
    expect(tool.input.safeParse({ query: '   ' }).success).toBe(false);
    expect(tool.input.safeParse({}).success).toBe(false);
  });
});
