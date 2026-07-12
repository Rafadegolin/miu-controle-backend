import { TransactionType } from '@prisma/client';

export interface ParsedMessage {
  amount: number;
  type: TransactionType;
  description: string;
}

// Palavras que indicam RECEITA (senão assume DESPESA).
const INCOME_KEYWORDS = [
  'recebi',
  'recebido',
  'recebimento',
  'salario',
  'salário',
  'entrada',
  'ganhei',
  'receita',
  'rendimento',
  'reembolso',
];

/**
 * Interpreta uma mensagem livre de WhatsApp em uma transação.
 * Exemplos: "mercado 50", "uber 25,90", "+2000 salário", "-12,50 café".
 * Retorna null se não houver um valor reconhecível.
 */
export function parseWhatsappMessage(rawText: string): ParsedMessage | null {
  if (!rawText) return null;
  const text = rawText.trim();
  if (!text) return null;

  const lower = text.toLowerCase();

  // 1. Tipo: sinal explícito tem prioridade; senão, palavras-chave; senão despesa.
  let type: TransactionType = TransactionType.EXPENSE;
  if (text.startsWith('+')) {
    type = TransactionType.INCOME;
  } else if (text.startsWith('-')) {
    type = TransactionType.EXPENSE;
  } else if (INCOME_KEYWORDS.some((k) => lower.includes(k))) {
    type = TransactionType.INCOME;
  }

  // 2. Valor: primeiro número monetário (aceita R$, milhar com ponto, decimal vírgula/ponto).
  const amountRegex =
    /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{1,2}|\d+,\d{1,2}|\d+\.\d{1,2}|\d+)/i;
  const match = text.match(amountRegex);
  if (!match) return null;

  const amount = normalizeAmount(match[1]);
  if (!isFinite(amount) || amount <= 0) return null;

  // 3. Descrição: texto sem o trecho do valor e sem o sinal/keywords iniciais.
  let description = text.replace(match[0], ' ');
  description = description.replace(/^[\s+\-]+/, ''); // sinais iniciais
  description = description.replace(/\s+/g, ' ').trim();

  if (!description) description = 'Lançamento via WhatsApp';

  return { amount, type, description };
}

/** Normaliza o número textual em float (trata milhar/decimal BR e ponto). */
function normalizeAmount(raw: string): number {
  let s = raw.trim();
  if (s.includes(',')) {
    // vírgula é decimal; pontos são milhar
    s = s.replace(/\./g, '').replace(',', '.');
  }
  return parseFloat(s);
}
