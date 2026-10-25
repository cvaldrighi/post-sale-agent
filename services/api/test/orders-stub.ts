import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';

/**
 * Servidor falso do orders para os testes E2E da api: responde como o contrato manda,
 * com dados fixos, e guarda os headers recebidos.
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

export interface OrdersStub {
  server: Server;
  requests: { url: string; headers: IncomingHttpHeaders }[];
  /** Quando true, responde 503 a tudo (serviço fora do ar). */
  down: boolean;
  close(): Promise<void>;
}

export async function startOrdersStub(): Promise<OrdersStub> {
  const stub = { requests: [], down: false } as unknown as OrdersStub;

  stub.server = createServer((req, res) => {
    stub.requests.push({ url: req.url ?? '', headers: req.headers });
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (req.headers['x-api-key'] !== ORDERS_STUB_KEY) return send(401, { code: 'unauthorized' });
    if (stub.down) return send(503, { code: 'service_unavailable' });

    const match = /^\/orders\/([^/]+)$/.exec(req.url ?? '');
    const order = match ? orders[decodeURIComponent(match[1])] : undefined;
    if (order) return send(200, order);
    return send(404, { code: 'order_not_found' });
  });

  await new Promise<void>((resolve) => stub.server.listen(ORDERS_STUB_PORT, '127.0.0.1', resolve));
  stub.close = () => new Promise((resolve) => stub.server.close(() => resolve()));
  return stub;
}
