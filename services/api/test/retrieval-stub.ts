import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';

/**
 * Servidor falso do retrieval para os testes E2E da api: responde como contracts/retrieval.json
 * manda, com um trecho fixo, e guarda as requisições recebidas.
 */
export const RETRIEVAL_STUB_PORT = 3903;
export const RETRIEVAL_STUB_KEY = 'stub-retrieval-key-0123456789';

export const PIX_RULE = {
  chunkId: 6,
  source: 'estornos',
  documentTitle: 'Política de Estornos',
  section: 'Política de Estornos > Prazo para Pix',
  text: 'O estorno de pagamentos feitos por Pix volta para a conta de origem em até 1 dia útil.',
  score: 0.016393,
};

export interface RetrievalStub {
  server: Server;
  requests: { url: string; headers: IncomingHttpHeaders; body: unknown }[];
  /** Quando true, responde 503 a tudo (serviço fora do ar). */
  down: boolean;
  /** Trechos devolvidos pela busca. */
  results: object[];
  close(): Promise<void>;
}

export async function startRetrievalStub(): Promise<RetrievalStub> {
  const stub = { requests: [], down: false, results: [PIX_RULE] } as unknown as RetrievalStub;

  stub.server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      stub.requests.push({ url: req.url ?? '', headers: req.headers, body: raw ? JSON.parse(raw) : null });
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };

      if (req.headers['x-api-key'] !== RETRIEVAL_STUB_KEY) return send(401, { code: 'unauthorized' });
      if (stub.down) return send(503, { code: 'service_unavailable' });
      if (req.method === 'POST' && req.url === '/search') return send(200, { results: stub.results });
      return send(404, { code: 'not_found' });
    });
  });

  await new Promise<void>((resolve) => stub.server.listen(RETRIEVAL_STUB_PORT, '127.0.0.1', resolve));
  stub.close = () => new Promise((resolve) => stub.server.close(() => resolve()));
  return stub;
}
