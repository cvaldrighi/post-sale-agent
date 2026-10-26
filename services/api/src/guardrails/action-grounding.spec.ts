import { isUngroundedActionClaim } from './action-grounding';

const none = new Set<string>();

describe('isUngroundedActionClaim', () => {
  it.each([
    'Preparei a solicitação de estorno de R$ 189,90 do pedido ord_1001.',
    'Solicitei o estorno do seu pedido.',
    'Pronto, fiz o estorno!',
    'Registrei o pedido de estorno para você.',
    'A solicitação de estorno foi criada.',
    // Frases reais da avaliação, sem a ferramenta ter rodado
    'Preparando a solicitação de estorno para o pedido ord_1002 no valor total.',
    'O estorno só acontecerá depois que você aprovar a solicitação.',
  ])('flags "%s" without request_refund', (reply) => {
    expect(isUngroundedActionClaim(reply, none)).toBe(true);
  });

  it('accepts the claim after a successful request_refund', () => {
    const reply = 'Preparei a solicitação de estorno de R$ 189,90 do pedido ord_1001.';

    expect(isUngroundedActionClaim(reply, new Set(['request_refund']))).toBe(false);
  });

  it.each([
    'Posso preparar a solicitação de estorno para você?',
    'Vou solicitar o estorno assim que você confirmar o pedido.',
    'Para solicitar o estorno, me diga o número do pedido.',
    'Pela nossa Política de Estornos, o Pix volta em até 1 dia útil.',
  ])('lets "%s" through: offers and explanations are not claims', (reply) => {
    expect(isUngroundedActionClaim(reply, none)).toBe(false);
  });
});
