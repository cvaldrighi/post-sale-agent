import type { Response } from 'supertest';
import { contractErrors } from './contract';

expect.extend({
  toMatchContract(received: Response) {
    const errors = contractErrors(received);
    return {
      pass: errors.length === 0,
      message: () =>
        errors.length > 0
          ? `Resposta fora do contrato:\n${errors.join('\n')}\nCorpo: ${JSON.stringify(received.body)}`
          : 'Era esperado que a resposta divergisse do contrato',
    };
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchContract(): R;
    }
  }
}
