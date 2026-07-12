import { parseWhatsappMessage } from './message-parser';

describe('parseWhatsappMessage', () => {
  it('despesa simples "mercado 50"', () => {
    expect(parseWhatsappMessage('mercado 50')).toEqual({
      amount: 50,
      type: 'EXPENSE',
      description: 'mercado',
    });
  });

  it('despesa com decimal vírgula "uber 25,90"', () => {
    expect(parseWhatsappMessage('uber 25,90')).toEqual({
      amount: 25.9,
      type: 'EXPENSE',
      description: 'uber',
    });
  });

  it('receita por palavra-chave "recebi 2000 salário"', () => {
    expect(parseWhatsappMessage('recebi 2000 salário')).toEqual({
      amount: 2000,
      type: 'INCOME',
      description: 'recebi salário',
    });
  });

  it('receita por sinal "+1.234,56 freela"', () => {
    expect(parseWhatsappMessage('+1.234,56 freela')).toEqual({
      amount: 1234.56,
      type: 'INCOME',
      description: 'freela',
    });
  });

  it('despesa por sinal "-12,50 café"', () => {
    expect(parseWhatsappMessage('-12,50 café')).toEqual({
      amount: 12.5,
      type: 'EXPENSE',
      description: 'café',
    });
  });

  it('aceita prefixo R$ "R$ 89.90 farmacia"', () => {
    expect(parseWhatsappMessage('R$ 89.90 farmacia')).toEqual({
      amount: 89.9,
      type: 'EXPENSE',
      description: 'farmacia',
    });
  });

  it('descrição vazia vira padrão', () => {
    const r = parseWhatsappMessage('150');
    expect(r?.amount).toBe(150);
    expect(r?.description).toBe('Lançamento via WhatsApp');
  });

  it('retorna null sem valor', () => {
    expect(parseWhatsappMessage('oi tudo bem?')).toBeNull();
    expect(parseWhatsappMessage('')).toBeNull();
  });
});
