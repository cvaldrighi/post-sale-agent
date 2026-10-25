import { RetrievalApiError, RetrievalClient } from './retrieval.client';

const result = {
  chunkId: 6,
  source: 'estornos',
  documentTitle: 'Política de Estornos',
  section: 'Política de Estornos > Prazo para Pix',
  text: 'O dinheiro volta para a conta de origem em até 1 dia útil.',
  score: 0.016393,
};

/** fetch simulado: cada chamada consome a próxima resposta da lista. */
function fakeFetch(...responses: (Response | Error)[]) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    const next = responses[Math.min(requests.length - 1, responses.length - 1)];
    if (next instanceof Error) throw next;
    return next.clone();
  }) as unknown as typeof fetch;
  return { fn, requests };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function client(fetchFn: typeof fetch) {
  return new RetrievalClient({
    baseUrl: 'http://retrieval:8000',
    apiKey: 'key-0123456789abcdef',
    timeoutMs: 100,
    fetchFn,
    sleep: async () => undefined, // sem esperar de verdade nos testes
  });
}

describe('RetrievalClient', () => {
  it('posts the query with the API key and the correlation id', async () => {
    const { fn, requests } = fakeFetch(json({ results: [result] }));

    const results = await client(fn).search({ query: 'prazo do Pix', topK: 4 }, 'corr-123');

    expect(results).toEqual([result]);
    expect(requests[0].url).toBe('http://retrieval:8000/search');
    expect(requests[0].init.method).toBe('POST');
    expect(requests[0].init.body).toBe(JSON.stringify({ query: 'prazo do Pix', topK: 4 }));
    expect(requests[0].init.headers).toEqual({
      'content-type': 'application/json',
      'x-api-key': 'key-0123456789abcdef',
      'x-correlation-id': 'corr-123',
    });
  });

  it('retries a 503 and returns the next success', async () => {
    const { fn, requests } = fakeFetch(json({}, 503), json({ results: [result] }));

    await expect(client(fn).search({ query: 'Pix', topK: 4 }, 'c')).resolves.toHaveLength(1);
    expect(requests).toHaveLength(2);
  });

  it('fails as unavailable after 3 network errors, without a 4th attempt', async () => {
    const { fn, requests } = fakeFetch(new Error('ECONNREFUSED'));

    await expect(client(fn).search({ query: 'Pix', topK: 4 }, 'c')).rejects.toBeInstanceOf(
      RetrievalApiError,
    );
    expect(requests).toHaveLength(3);
  });

  it('does not retry a 401', async () => {
    const { fn, requests } = fakeFetch(json({ code: 'unauthorized' }, 401));

    await expect(client(fn).search({ query: 'Pix', topK: 4 }, 'c')).rejects.toBeInstanceOf(
      RetrievalApiError,
    );
    expect(requests).toHaveLength(1);
  });

  it('rejects a response that breaks the contract', async () => {
    const { text: _text, ...withoutText } = result;
    const { fn } = fakeFetch(json({ results: [withoutText] }));

    await expect(client(fn).search({ query: 'Pix', topK: 4 }, 'c')).rejects.toThrow(/fora do contrato/);
  });
});
