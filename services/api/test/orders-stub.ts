import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';

/**
 * Servidor falso do orders para os testes E2E da api: responde como o contrato manda,
 * com dados fixos, e guarda as requisições recebidas.
 */
export const ORDERS_STUB_PORT = 3902;
export const ORDERS_STUB_KEY = 'stub-orders-key-0123456789';

const orders: Record<string, object> = {
  ord_1001: {
    id: 'ord_1001',
    customerId: 'cust_001',
    customer: { name: 'Ana Souza', document: '123.456.789-09' },
    status: 'delayed',
    items: [{ sku: 'FONE-BT-01', name: 'Fone de ouvido Bluetooth', quantity: 1, unitPriceCents: 18990 }],
    totalCents: 18990,
    currency: 'BRL',
    createdAt: '2026-10-10T13:00:00.000Z',
    estimatedDeliveryDate: '2026-10-17',
    deliveredAt: null,
  },
  ord_2001: {
    id: 'ord_2001',
    customerId: 'cust_002',
    customer: { name: 'Bruno Lima', document: '987.654.321-00' },
    status: 'canceled',
    items: [{ sku: 'MOCHILA-01', name: 'Mochila', quantity: 1, unitPriceCents: 12900 }],
    totalCents: 12900,
    currency: 'BRL',
    createdAt: '2026-09-01T09:00:00.000Z',
    estimatedDeliveryDate: '2026-09-08',
    deliveredAt: null,
  },
};

const payments: Record<string, object> = {
  ord_1001: {
    id: 'pay_1001',
    orderId: 'ord_1001',
    method: 'pix',
    status: 'confirmed',
    amountCents: 18990,
    refundedAmountCents: 0,
    currency: 'BRL',
    paidAt: '2026-10-10T13:02:00.000Z',
    cardLast4: null,
  },
};

export interface OrdersStub {
  server: Server;
  requests: { method: string; url: string; headers: IncomingHttpHeaders; body: unknown }[];
  /** Quando true, responde 503 a tudo (serviço fora do ar). */
  down: boolean;
  /** Quando definido, POST /refunds responde este erro (regra de negócio do orders). */
  refundError: { status: 409 | 422; code: string } | null;
  /** Estornos criados, por Idempotency-Key: a mesma chave devolve o mesmo estorno, como no orders. */
  refunds: Map<string, object>;
  close(): Promise<void>;
}

export async function startOrdersStub(): Promise<OrdersStub> {
  const stub = {
    requests: [],
    down: false,
    refundError: null,
    refunds: new Map(),
  } as unknown as OrdersStub;

  stub.server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      const body: unknown = raw ? JSON.parse(raw) : null;
      stub.requests.push({ method: req.method ?? 'GET', url: req.url ?? '', headers: req.headers, body });
      const send = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };

      if (req.headers['x-api-key'] !== ORDERS_STUB_KEY) return send(401, { code: 'unauthorized' });
      if (stub.down) return send(503, { code: 'service_unavailable' });

      if (req.method === 'POST' && req.url === '/refunds') return refund(stub, req.headers, body, send);

      const payment = /^\/orders\/([^/]+)\/payment$/.exec(req.url ?? '');
      if (payment) {
        const found = payments[decodeURIComponent(payment[1])];
        return found ? send(200, found) : send(404, { code: 'order_not_found' });
      }

      const match = /^\/orders\/([^/]+)$/.exec(req.url ?? '');
      const order = match ? orders[decodeURIComponent(match[1])] : undefined;
      if (order) return send(200, order);
      return send(404, { code: 'order_not_found' });
    });
  });

  await new Promise<void>((resolve) => stub.server.listen(ORDERS_STUB_PORT, '127.0.0.1', resolve));
  stub.close = () => new Promise((resolve) => stub.server.close(() => resolve()));
  return stub;
}

function refund(
  stub: OrdersStub,
  headers: IncomingHttpHeaders,
  body: unknown,
  send: (status: number, payload: unknown) => void,
) {
  const key = headers['idempotency-key'];
  if (typeof key !== 'string') return send(400, { code: 'idempotency_key_required' });
  if (stub.refundError) return send(stub.refundError.status, { code: stub.refundError.code });

  const existing = stub.refunds.get(key);
  if (existing) return send(200, existing);

  const { orderId, amountCents, reason } = body as { orderId: string; amountCents: number; reason: string };
  const created = {
    id: `ref_${stub.refunds.size + 1}`,
    orderId,
    paymentId: `pay_${orderId.replace('ord_', '')}`,
    amountCents,
    currency: 'BRL',
    reason,
    status: 'completed',
    createdAt: new Date().toISOString(),
  };
  stub.refunds.set(key, created);
  return send(201, created);
}
