import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildLoggerParams, resolveCorrelationId } from './logging';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('resolveCorrelationId', () => {
  it('keeps a valid id', () => {
    expect(resolveCorrelationId('abc-123')).toBe('abc-123');
  });

  it('generates a uuid when the header is missing', () => {
    expect(resolveCorrelationId(undefined)).toMatch(UUID);
  });

  it('replaces ids that could inject text into the logs', () => {
    expect(resolveCorrelationId('abc\n{"level":"fatal"}')).toMatch(UUID);
  });
});

describe('buildLoggerParams', () => {
  const pinoHttp = buildLoggerParams('info').pinoHttp as unknown as {
    genReqId: (req: IncomingMessage, res: ServerResponse) => string;
    customProps: (req: IncomingMessage) => object;
  };

  it('echoes the correlation id in the response header', () => {
    const headers: Record<string, string> = {};
    const res = { setHeader: (k: string, v: string) => (headers[k] = v) } as unknown as ServerResponse;
    const req = { headers: { 'x-correlation-id': 'abc-123' } } as unknown as IncomingMessage;

    expect(pinoHttp.genReqId(req, res)).toBe('abc-123');
    expect(headers['x-correlation-id']).toBe('abc-123');
  });

  it('adds correlationId to every log line of the request', () => {
    const req = { id: 'abc-123' } as unknown as IncomingMessage;

    expect(pinoHttp.customProps(req)).toEqual({ correlationId: 'abc-123' });
  });
});
