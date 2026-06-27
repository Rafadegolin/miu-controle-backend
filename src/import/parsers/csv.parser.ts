import { TransactionType } from '@prisma/client';
import { ParsedTx } from './ofx.parser';

export type CsvDateFormat =
  | 'DD/MM/YYYY'
  | 'DD-MM-YYYY'
  | 'YYYY-MM-DD'
  | 'MM/DD/YYYY';

export interface CsvParseOptions {
  /** Separador de colunas. Default ';' (comum em exports BR). */
  delimiter?: string;
  /** Separador decimal do valor. Default ',' (BR). */
  decimalSeparator?: string;
  /** Formato da data na planilha. Default 'DD/MM/YYYY'. */
  dateFormat?: CsvDateFormat;
  /** Primeira linha é cabeçalho? Default true. */
  hasHeader?: boolean;
  /** Coluna da data — nome do cabeçalho (se hasHeader) ou índice numérico. */
  dateColumn: string;
  /** Coluna do valor. */
  amountColumn: string;
  /** Coluna da descrição. */
  descriptionColumn: string;
  /**
   * Coluna opcional do tipo (ex: "C"/"D", "CREDITO"/"DEBITO"). Se ausente, o
   * tipo é inferido pelo sinal do valor (negativo = despesa).
   */
  typeColumn?: string;
}

/**
 * Parser de CSV genérico com mapeamento de colunas configurável. Sem dependência
 * externa — splitter próprio com suporte a campos entre aspas.
 */
export function parseCsv(content: string, options: CsvParseOptions): ParsedTx[] {
  const delimiter = options.delimiter ?? ';';
  const decimalSeparator = options.decimalSeparator ?? ',';
  const dateFormat = options.dateFormat ?? 'DD/MM/YYYY';
  const hasHeader = options.hasHeader ?? true;

  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) throw new Error('Arquivo CSV vazio.');

  let headers: string[] = [];
  let dataLines = lines;
  if (hasHeader) {
    headers = splitCsvLine(lines[0], delimiter).map((h) =>
      h.trim().toLowerCase(),
    );
    dataLines = lines.slice(1);
  }

  const dateIdx = resolveColumn(options.dateColumn, headers, hasHeader);
  const amountIdx = resolveColumn(options.amountColumn, headers, hasHeader);
  const descIdx = resolveColumn(options.descriptionColumn, headers, hasHeader);
  const typeIdx = options.typeColumn
    ? resolveColumn(options.typeColumn, headers, hasHeader)
    : -1;

  const txs: ParsedTx[] = [];

  for (const line of dataLines) {
    const cells = splitCsvLine(line, delimiter);
    const rawAmount = cells[amountIdx];
    const rawDate = cells[dateIdx];
    if (rawAmount === undefined || rawDate === undefined) continue;

    const amount = parseAmount(rawAmount, decimalSeparator);
    if (!isFinite(amount) || amount === 0) continue;

    const date = parseDate(rawDate.trim(), dateFormat);
    if (!date) continue;

    let type: TransactionType;
    if (typeIdx >= 0 && cells[typeIdx]) {
      type = parseTypeCell(cells[typeIdx]);
    } else {
      type = amount < 0 ? TransactionType.EXPENSE : TransactionType.INCOME;
    }

    txs.push({
      date,
      amount: Math.abs(amount),
      type,
      description: (cells[descIdx] ?? 'Lançamento importado').trim(),
    });
  }

  if (txs.length === 0) {
    throw new Error(
      'Nenhuma transação válida no CSV. Verifique o mapeamento de colunas e os separadores.',
    );
  }

  return txs;
}

/** Resolve uma coluna por nome de cabeçalho (case-insensitive) ou índice numérico. */
function resolveColumn(
  column: string,
  headers: string[],
  hasHeader: boolean,
): number {
  if (hasHeader) {
    const idx = headers.indexOf(column.trim().toLowerCase());
    if (idx === -1) {
      throw new Error(`Coluna "${column}" não encontrada no cabeçalho do CSV.`);
    }
    return idx;
  }
  const idx = parseInt(column, 10);
  if (isNaN(idx)) {
    throw new Error(
      `Sem cabeçalho: a coluna "${column}" deve ser um índice numérico (0, 1, 2...).`,
    );
  }
  return idx;
}

/** Divide uma linha CSV respeitando campos entre aspas duplas. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'; // aspas escapadas ("")
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/** Converte o valor textual em número, removendo separadores de milhar. */
function parseAmount(raw: string, decimalSeparator: string): number {
  let s = raw.trim().replace(/["\s]/g, '');
  if (decimalSeparator === ',') {
    // Remove pontos de milhar e troca a vírgula decimal por ponto.
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Decimal é ponto; remove vírgulas de milhar.
    s = s.replace(/,/g, '');
  }
  return Number(s);
}

/** Converte uma data textual no formato informado para ISO yyyy-mm-dd. */
function parseDate(raw: string, format: CsvDateFormat): string | null {
  const parts = raw.split(/[/\-.]/).map((p) => p.trim());
  if (parts.length !== 3) return null;

  let year: string, month: string, day: string;
  switch (format) {
    case 'YYYY-MM-DD':
      [year, month, day] = parts;
      break;
    case 'MM/DD/YYYY':
      [month, day, year] = parts;
      break;
    case 'DD-MM-YYYY':
    case 'DD/MM/YYYY':
    default:
      [day, month, year] = parts;
      break;
  }

  if (year.length === 2) year = `20${year}`;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Interpreta uma célula de tipo (C/D, CREDITO/DEBITO, INCOME/EXPENSE). */
function parseTypeCell(raw: string): TransactionType {
  const v = raw.trim().toUpperCase();
  if (
    v.startsWith('C') ||
    v.includes('CRED') ||
    v.includes('INCOME') ||
    v.includes('ENTRADA') ||
    v.includes('RECEITA')
  ) {
    return TransactionType.INCOME;
  }
  return TransactionType.EXPENSE;
}
