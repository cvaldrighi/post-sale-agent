import { maskPii, passesLuhn } from './pii';

describe('maskPii', () => {
  it('masks a formatted CPF and a card with spaces', () => {
    const result = maskPii('meu CPF é 123.456.789-09 e o cartão 4111 1111 1111 1111');

    expect(result.text).toBe('meu CPF é [CPF] e o cartão [CARTÃO]');
    expect(result.counts).toEqual({ cpf: 1, card: 1 });
  });

  it('masks a CPF typed as 11 digits and a card with hyphens', () => {
    expect(maskPii('cpf 12345678909, cartão 5555-5555-5555-4444').text).toBe('cpf [CPF], cartão [CARTÃO]');
  });

  it('masks a card typed without separators', () => {
    expect(maskPii('4111111111111111').text).toBe('[CARTÃO]');
  });

  it('keeps a long number that is not a valid card', () => {
    // 16 dígitos que não passam no Luhn: protocolo, código de rastreio...
    expect(maskPii('protocolo 1234 5678 9012 3456').text).toBe('protocolo 1234 5678 9012 3456');
  });

  it('keeps order ids and phone numbers', () => {
    const result = maskPii('pedido ord_1001, telefone 13 99999-0000');

    expect(result.text).toBe('pedido ord_1001, telefone 13 99999-0000');
    expect(result.counts).toEqual({ cpf: 0, card: 0 });
  });
});

describe('passesLuhn', () => {
  it('accepts test card numbers and rejects a changed digit', () => {
    expect(passesLuhn('4111111111111111')).toBe(true);
    expect(passesLuhn('5555555555554444')).toBe(true);
    expect(passesLuhn('4111111111111112')).toBe(false);
  });
});
