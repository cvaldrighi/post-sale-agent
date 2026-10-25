import { TransientError, withRetry } from './retry';

function sequence<T>(...steps: (T | Error)[]) {
  let calls = 0;
  const operation = async () => {
    const step = steps[Math.min(calls, steps.length - 1)];
    calls++;
    if (step instanceof Error) throw step;
    return step;
  };
  return { operation, calls: () => calls };
}

const waits: number[] = [];
const options = { attempts: 3, delaysMs: [200, 400], sleep: async (ms: number) => void waits.push(ms) };

describe('withRetry', () => {
  beforeEach(() => (waits.length = 0));

  it('retries a temporary failure and returns the next success', async () => {
    const { operation, calls } = sequence(new TransientError('503'), 'ok');

    await expect(withRetry(operation, options)).resolves.toBe('ok');
    expect(calls()).toBe(2);
    expect(waits).toEqual([200]);
  });

  it('gives up after 3 attempts with increasing waits', async () => {
    const { operation, calls } = sequence(new TransientError('timeout'));

    await expect(withRetry(operation, options)).rejects.toThrow('timeout');
    expect(calls()).toBe(3);
    expect(waits).toEqual([200, 400]);
  });

  it('does not retry errors that are not temporary (ex.: 404)', async () => {
    const { operation, calls } = sequence(new Error('404'));

    await expect(withRetry(operation, options)).rejects.toThrow('404');
    expect(calls()).toBe(1);
    expect(waits).toEqual([]);
  });
});
