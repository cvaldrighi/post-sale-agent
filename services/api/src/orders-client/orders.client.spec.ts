import { OrdersApiError, OrdersClient } from './orders.client';

const order = {
  id: 'ord_1001',
  customerId: 'cust_001',
  customer: { name: 'Ana Souza', document: '123.456.789-09' },
  status: 'delayed',
  items: [{ sku: 'FONE', name: 'Fone', quantity: 1, unitPriceCents: 18990 }],
  totalCents: 18990,
  currency: 'BRL',
  createdAt: '2026-10-10T13:00:00.000Z',
  estimatedDeliveryDate: '2026-10-17',
  deliveredAt: null,
};

/** fetch simulado: cada chamada consome a próxima resposta da lista. */
function fakeFetch(...responses: (Response | Error)[]) {
  const requests: { url: string; method?: string; headers: Record<string, string>; body?: unknown }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    requests.push({
      url,
      method: init.method,
      headers: init.headers as Record<string, string>,
      body: init.body,
    });
    const next = responses[Math.min(requests.length - 1, responses.length - 1)];
    if (next instanceof Error) throw next;
    return next.clone();
  }) as unknown as typeof fetch;
  return { fn, requests };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function client(fetchFn: typeof fetch) {
  return new OrdersClient({
    baseUrl: 'http://orders:3002',
    apiKey: 'key-0123456789abcdef',
    timeoutMs: 100,
    fetchFn,
    sleep: async () => undefined, // sem esperar de verdade nos testes
  });
}

describe('OrdersClient', () => {
  it('sends the API key and the correlation id', async () => {
    const { fn, requests } = fakeFetch(json(order));

    await client(fn).getOrder('ord_1001', 'corr-123');

    expect(requests[0].url).toBe('http://orders:3002/orders/ord_1001');
    expect(requests[0].headers).toEqual({
      'x-api-key': 'key-0123456789abcdef',
      'x-correlation-id': 'corr-123',
    });
  });

  it('retries a 503 and returns the next success', async () => {
    const { fn, requests } = fakeFetch(json({}, 503), json(order));

    await expect(client(fn).getOrder('ord_1001', 'c')).resolves.toMatchObject({ id: 'ord_1001' });
    expect(requests).toHaveLength(2);
  });

  it('fails as unavailable after 3 network errors, without a 4th attempt', async () => {
    const { fn, requests } = fakeFetch(new Error('ECONNREFUSED'));

    await expect(client(fn).getOrder('ord_1001', 'c')).rejects.toMatchObject({ kind: 'unavailable' });
    expect(requests).toHaveLength(3);
  });

  it('does not retry a 404 and reports not_found', async () => {
    const { fn, requests } = fakeFetch(json({ code: 'order_not_found' }, 404));

    const error = await client(fn).getOrder('ord_9999', 'c').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OrdersApiError);
    expect(error).toMatchObject({ kind: 'not_found' });
    expect(requests).toHaveLength(1);
  });

  it('rejects a response that breaks the contract', async () => {
    const { status: _status, ...withoutStatus } = order;
    const { fn } = fakeFetch(json(withoutStatus));

    await expect(client(fn).getOrder('ord_1001', 'c')).rejects.toMatchObject({
      kind: 'unavailable',
      message: expect.stringContaining('fora do contrato'),
    });
  });

  it('lists the customer orders', async () => {
    const summary = { id: 'ord_1001', status: 'delayed', totalCents: 18990, currency: 'BRL', createdAt: order.createdAt };
    const { fn, requests } = fakeFetch(json({ data: [summary] }));

    await expect(client(fn).listCustomerOrders('cust_001', 'c')).resolves.toEqual([summary]);
    expect(requests[0].url).toBe('http://orders:3002/customers/cust_001/orders');
  });
});

describe('OrdersClient.createRefund', () => {
  const refund = {
    id: 'ref_1',
    orderId: 'ord_1001',
    paymentId: 'pay_1001',
    amountCents: 18990,
    currency: 'BRL',
    reason: 'Pedido atrasado',
    status: 'completed',
    createdAt: '2026-10-25T22:00:00.000Z',
  };
  const input = { orderId: 'ord_1001', amountCents: 18990, reason: 'Pedido atrasado' };

  it('posts the refund with the idempotency key', async () => {
    const { fn, requests } = fakeFetch(json(refund, 201));

    await expect(client(fn).createRefund(input, 'action-1', 'corr-1')).resolves.toEqual(refund);
    expect(requests[0]).toEqual({
      url: 'http://orders:3002/refunds',
      method: 'POST',
      headers: {
        'x-api-key': 'key-0123456789abcdef',
        'x-correlation-id': 'corr-1',
        'content-type': 'application/json',
        'idempotency-key': 'action-1',
      },
      body: JSON.stringify(input),
    });
  });

  it('retries a 503 with the same idempotency key', async () => {
    const { fn, requests } = fakeFetch(json({}, 503), json(refund, 201));

    await expect(client(fn).createRefund(input, 'action-1', 'c')).resolves.toMatchObject({ id: 'ref_1' });
    expect(requests.map((r) => r.headers['idempotency-key'])).toEqual(['action-1', 'action-1']);
  });

  it('does not retry a 422 and reports the code', async () => {
    const { fn, requests } = fakeFetch(json({ code: 'amount_exceeds_refundable' }, 422));

    await expect(client(fn).createRefund(input, 'action-1', 'c')).rejects.toMatchObject({
      kind: 'rejected',
      code: 'amount_exceeds_refundable',
    });
    expect(requests).toHaveLength(1);
  });

  it('reports a 409 as rejected with its code', async () => {
    const { fn } = fakeFetch(json({ code: 'payment_not_refundable' }, 409));

    await expect(client(fn).createRefund(input, 'action-1', 'c')).rejects.toMatchObject({
      kind: 'rejected',
      code: 'payment_not_refundable',
    });
  });
});
