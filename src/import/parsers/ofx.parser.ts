import { TransactionType } from '@prisma/client';

export interface ParsedTx {
  date: string; // ISO yyyy-mm-dd
  amount: number; // sempre positivo
  type: TransactionType;
  description: string;
  externalId?: string;
}

/**
 * Parser de OFX (1.x SGML e 2.x XML) focado nos blocos <STMTTRN>.
 *
 * OFX 1.x é SGML — as tags frequentemente NÃO são fechadas, ex:
 *   <STMTTRN>
 *   <TRNTYPE>DEBIT
 *   <DTPOSTED>20240115
 *   <TRNAMT>-50.00
 *   <FITID>123
 *   <MEMO>Compra X
 *   </STMTTRN>
 * Por isso extraímos cada campo até o fim da linha ou a próxima tag, em vez de
 * exigir tags de fechamento. Não há dependência externa.
 */
export function parseOfx(content: string): ParsedTx[] {
  if (!content || !/<STMTTRN>/i.test(content)) {
    throw new Error('Arquivo OFX inválido: nenhum lançamento <STMTTRN> encontrado.');
  }

  // Quebra em blocos de transação. Cada bloco vai do <STMTTRN> até o próximo
  // <STMTTRN> ou o fim da lista de transações.
  const blocks = content
    .split(/<STMTTRN>/i)
    .slice(1) // descarta o cabeçalho antes do primeiro <STMTTRN>
    .map((b) => b.split(/<\/STMTTRN>/i)[0]);

  const txs: ParsedTx[] = [];

  for (const block of blocks) {
    const rawAmount = field(block, 'TRNAMT');
    const rawDate = field(block, 'DTPOSTED');
    if (rawAmount === null || rawDate === null) continue;

    const amount = Number(rawAmount.replace(',', '.'));
    if (!isFinite(amount) || amount === 0) continue;

    const date = parseOfxDate(rawDate);
    if (!date) continue;

    const description =
      field(block, 'MEMO') ||
      field(block, 'NAME') ||
      field(block, 'CHECKNUM') ||
      'Lançamento importado';

    txs.push({
      date,
      amount: Math.abs(amount),
      type: amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME,
      description: description.trim(),
      externalId: field(block, 'FITID') ?? undefined,
    });
  }

  if (txs.length === 0) {
    throw new Error('Nenhuma transação válida encontrada no OFX.');
  }

  return txs;
}

/** Extrai o valor de uma tag SGML/XML até o fim da linha ou a próxima tag. */
function field(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i');
  const m = block.match(re);
  if (!m) return null;
  const value = m[1].trim();
  return value.length > 0 ? value : null;
}

/** Converte DTPOSTED (YYYYMMDD[HHMMSS][.xxx][TZ]) para ISO yyyy-mm-dd. */
function parseOfxDate(raw: string): string | null {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo}-${d}`;
}
