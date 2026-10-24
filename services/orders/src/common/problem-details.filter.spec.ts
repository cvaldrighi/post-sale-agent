import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ProblemException } from './problem';
import { ProblemDetailsFilter } from './problem-details.filter';

function capture(exception: unknown) {
  const response = {
    statusCode: 0,
    contentType: '',
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    type(value: string) {
      this.contentType = value;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  new ProblemDetailsFilter().catch(exception, host);
  return response;
}

describe('ProblemDetailsFilter', () => {
  it('keeps the code of a ProblemException', () => {
    const res = capture(
      new ProblemException('order_not_found', HttpStatus.NOT_FOUND, 'Pedido x não encontrado'),
    );

    expect(res.statusCode).toBe(404);
    expect(res.contentType).toBe('application/problem+json');
    expect(res.body).toEqual({
      type: 'https://post-sale-agent.dev/problems/order-not-found',
      title: 'Pedido não encontrado',
      status: 404,
      detail: 'Pedido x não encontrado',
      code: 'order_not_found',
    });
  });

  it('maps a Nest 404 (unknown route) to not_found', () => {
    const res = capture(new NotFoundException('Cannot GET /nope'));

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: 'not_found' });
  });

  it('maps other 4xx HttpExceptions to validation_error', () => {
    const res = capture(new BadRequestException());

    expect(res.body).toMatchObject({ status: 400, code: 'validation_error' });
  });

  it('logs unexpected errors but hides their details from the response', () => {
    const logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const error = new Error('connection refused at 10.0.0.5');

    const res = capture(error);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ code: 'internal_error' });
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5'); // nada interno na resposta
    expect(logError).toHaveBeenCalledWith(error); // mas o detalhe fica no log

    logError.mockRestore();
  });
});
