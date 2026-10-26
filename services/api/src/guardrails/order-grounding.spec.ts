import { findUngroundedOrderIds } from './order-grounding';

describe('findUngroundedOrderIds', () => {
  it('flags orders that no tool returned and nobody mentioned', () => {
    const reply = 'Listei seus pedidos recentes: ord_1005 (R$ 150,00) e ord_1006.';

    expect(findUngroundedOrderIds(reply, ['Meu CPF é [CPF], pode ver meus pedidos?'])).toEqual([
      'ord_1005',
      'ord_1006',
    ]);
  });

  it('accepts orders returned by a tool', () => {
    const toolData = JSON.stringify({ orders: [{ orderId: 'ord_1001' }, { orderId: 'ord_1002' }] });

    expect(findUngroundedOrderIds('Você tem os pedidos ord_1001 e ord_1002.', [toolData])).toEqual([]);
  });

  it('accepts an order the customer typed, as in "not found" answers', () => {
    const reply = 'Não encontrei o pedido ord_2001. Pode conferir o número?';

    expect(findUngroundedOrderIds(reply, ['Qual o status do pedido ord_2001?'])).toEqual([]);
  });

  it('ignores case and answers without order ids', () => {
    expect(findUngroundedOrderIds('Pedido ORD_1001 enviado.', ['ord_1001'])).toEqual([]);
    expect(findUngroundedOrderIds('O Pix volta em até 1 dia útil.', [])).toEqual([]);
  });
});
