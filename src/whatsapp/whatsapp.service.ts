import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { EvolutionService } from './evolution.service';
import { parseWhatsappMessage } from './parsers/message-parser';
import { TransactionSource, TransactionType } from '@prisma/client';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
    private readonly evolution: EvolutionService,
  ) {}

  /**
   * Processa um webhook de mensagem recebida da EvolutionAPI.
   * Identifica o usuário pelo telefone, interpreta a mensagem e cria a transação,
   * respondendo no WhatsApp com a confirmação (ou orientação em caso de erro).
   */
  async handleIncomingMessage(payload: any): Promise<void> {
    const data = payload?.data ?? payload;
    const key = data?.key;
    const remoteJid: string | undefined = key?.remoteJid;

    // Ignora mensagens nossas, de grupos, ou sem remetente.
    if (!remoteJid || key?.fromMe || remoteJid.endsWith('@g.us')) return;

    const text: string | undefined =
      data?.message?.conversation ??
      data?.message?.extendedTextMessage?.text ??
      undefined;
    if (!text || !text.trim()) return;

    const jidDigits = remoteJid.split('@')[0].replace(/\D/g, '');
    if (!jidDigits) return;

    const user = await this.findUserByPhone(jidDigits);
    if (!user) {
      await this.evolution.sendText(
        jidDigits,
        '🐱 Não encontrei seu cadastro no Miu Controle para este número. ' +
          'Cadastre seu telefone no app para registrar gastos por aqui.',
      );
      return;
    }

    const parsed = parseWhatsappMessage(text);
    if (!parsed) {
      await this.evolution.sendText(
        jidDigits,
        'Não entendi 🤔 Envie algo como "mercado 50", "uber 25,90" ou "+2000 salário".',
      );
      return;
    }

    const account = await this.prisma.account.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!account) {
      await this.evolution.sendText(
        jidDigits,
        'Você ainda não tem uma conta cadastrada no Miu Controle. Crie uma conta no app primeiro.',
      );
      return;
    }

    try {
      const transaction: any = await this.transactionsService.create(user.id, {
        accountId: account.id,
        type: parsed.type,
        amount: parsed.amount,
        description: parsed.description,
        source: TransactionSource.WHATSAPP,
      });

      const verb =
        parsed.type === TransactionType.INCOME ? 'Receita' : 'Despesa';
      const valueStr = parsed.amount.toFixed(2).replace('.', ',');
      const categoryName = transaction?.category?.name;

      await this.evolution.sendText(
        jidDigits,
        `✅ ${verb} registrada: R$ ${valueStr} — ${parsed.description}` +
          (categoryName ? ` (${categoryName})` : ''),
      );
    } catch (err: any) {
      this.logger.error(`Falha ao registrar transação via WhatsApp: ${err?.message}`);
      await this.evolution.sendText(
        jidDigits,
        'Ops, não consegui registrar agora. Tente novamente em instantes.',
      );
    }
  }

  /**
   * Encontra o usuário pelo telefone. Como User.phone não é normalizado nem
   * único, fazemos um filtro grosseiro (últimos 6 dígitos) e confirmamos
   * comparando os últimos 8 dígitos já normalizados (ignora DDI/formatação).
   */
  private async findUserByPhone(jidDigits: string) {
    const last6 = jidDigits.slice(-6);
    const candidates = await this.prisma.user.findMany({
      where: { phone: { contains: last6 }, isActive: true },
      select: { id: true, phone: true },
    });

    const target = jidDigits.slice(-8);
    for (const u of candidates) {
      const normalized = (u.phone || '').replace(/\D/g, '');
      if (normalized && normalized.slice(-8) === target) {
        return u;
      }
    }
    return null;
  }
}
