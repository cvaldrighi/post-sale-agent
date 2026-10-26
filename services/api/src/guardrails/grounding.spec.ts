import { isUngroundedPolicyAnswer } from './grounding';

const invented = 'Pela nossa Política de Devoluções, produtos personalizados não podem ser devolvidos.';

describe('isUngroundedPolicyAnswer', () => {
  it('flags a policy quoted without a successful policy search', () => {
    expect(isUngroundedPolicyAnswer(invented, new Set())).toBe(true);
    expect(isUngroundedPolicyAnswer(invented, new Set(['get_order']))).toBe(true);
  });

  it('accepts a policy quoted after a successful policy search', () => {
    expect(isUngroundedPolicyAnswer(invented, new Set(['search_policies']))).toBe(false);
  });

  it('matches the word with or without accent, singular or plural', () => {
    expect(isUngroundedPolicyAnswer('segundo as politicas da loja', new Set())).toBe(true);
    expect(isUngroundedPolicyAnswer('Veja nossas POLÍTICAS', new Set())).toBe(true);
  });

  it('ignores answers that do not quote a policy', () => {
    expect(isUngroundedPolicyAnswer('Seu pedido ord_1001 está atrasado.', new Set())).toBe(false);
  });
});
