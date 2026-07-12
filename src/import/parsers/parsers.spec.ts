import { parseOfx } from './ofx.parser';
import { parseCsv } from './csv.parser';

describe('parseOfx', () => {
  const ofx = `OFXHEADER:100
<OFX>
<BANKMSGSRSV1>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260115120000
<TRNAMT>-50.90
<FITID>A1
<MEMO>Compra Supermercado
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260116
<TRNAMT>2000.00
<FITID>A2
<MEMO>Salario
</STMTTRN>
</BANKMSGSRSV1>
</OFX>`;

  it('extrai transações de débito e crédito', () => {
    const txs = parseOfx(ofx);
    expect(txs).toHaveLength(2);

    expect(txs[0]).toEqual({
      date: '2026-01-15',
      amount: 50.9,
      type: 'EXPENSE',
      description: 'Compra Supermercado',
      externalId: 'A1',
    });

    expect(txs[1]).toEqual({
      date: '2026-01-16',
      amount: 2000,
      type: 'INCOME',
      description: 'Salario',
      externalId: 'A2',
    });
  });

  it('lança erro para conteúdo inválido', () => {
    expect(() => parseOfx('arquivo qualquer')).toThrow();
  });
});

describe('parseCsv', () => {
  it('parseia CSV BR (; / decimal vírgula / DD/MM/YYYY) inferindo o tipo pelo sinal', () => {
    const csv = [
      'Data;Valor;Descrição',
      '15/01/2026;-1.234,56;Compra Cartão',
      '16/01/2026;3.000,00;Salário',
    ].join('\n');

    const txs = parseCsv(csv, {
      delimiter: ';',
      decimalSeparator: ',',
      dateFormat: 'DD/MM/YYYY',
      hasHeader: true,
      dateColumn: 'Data',
      amountColumn: 'Valor',
      descriptionColumn: 'Descrição',
    });

    expect(txs).toHaveLength(2);
    expect(txs[0]).toMatchObject({
      date: '2026-01-15',
      amount: 1234.56,
      type: 'EXPENSE',
      description: 'Compra Cartão',
    });
    expect(txs[1]).toMatchObject({
      date: '2026-01-16',
      amount: 3000,
      type: 'INCOME',
      description: 'Salário',
    });
  });

  it('usa a coluna de tipo quando fornecida', () => {
    const csv = [
      'data,valor,desc,tipo',
      '2026-02-01,100.00,Item A,D',
      '2026-02-02,200.00,Item B,C',
    ].join('\n');

    const txs = parseCsv(csv, {
      delimiter: ',',
      decimalSeparator: '.',
      dateFormat: 'YYYY-MM-DD',
      hasHeader: true,
      dateColumn: 'data',
      amountColumn: 'valor',
      descriptionColumn: 'desc',
      typeColumn: 'tipo',
    });

    expect(txs[0].type).toBe('EXPENSE');
    expect(txs[1].type).toBe('INCOME');
  });

  it('respeita campos entre aspas com o delimitador dentro', () => {
    const csv = [
      'Data;Valor;Descrição',
      '10/03/2026;-9,90;"Padaria; e Café"',
    ].join('\n');

    const txs = parseCsv(csv, {
      delimiter: ';',
      decimalSeparator: ',',
      dateFormat: 'DD/MM/YYYY',
      dateColumn: 'Data',
      amountColumn: 'Valor',
      descriptionColumn: 'Descrição',
    });

    expect(txs[0].description).toBe('Padaria; e Café');
  });

  it('lança erro quando a coluna mapeada não existe', () => {
    const csv = 'A;B\n1;2';
    expect(() =>
      parseCsv(csv, {
        dateColumn: 'Data',
        amountColumn: 'Valor',
        descriptionColumn: 'Descrição',
      }),
    ).toThrow(/não encontrada/);
  });
});
