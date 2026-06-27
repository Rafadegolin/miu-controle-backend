import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/services/cache.service';
import { WebsocketService } from '../websocket/websocket.service';
import { WS_EVENTS } from '../websocket/events/websocket.events';
import { TransactionType } from '@prisma/client';
import { parseOfx, ParsedTx } from './parsers/ofx.parser';
import { parseCsv, CsvDateFormat } from './parsers/csv.parser';
import { ImportPreviewDto, ImportFormat } from './dto/import-preview.dto';
import { ConfirmImportDto } from './dto/confirm-import.dto';

const MAX_IMPORT_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
    private websocketService: WebsocketService,
  ) {}

  /**
   * Parseia o arquivo (OFX/CSV) e retorna um preview — NÃO salva nada.
   */
  preview(file: Express.Multer.File, dto: ImportPreviewDto) {
    if (!file) throw new BadRequestException('Arquivo é obrigatório.');
    if (file.size > MAX_IMPORT_SIZE) {
      throw new PayloadTooLargeException('Arquivo excede o limite de 5MB.');
    }

    const content = file.buffer.toString('utf-8');
    let transactions: ParsedTx[];

    try {
      if (dto.format === ImportFormat.OFX) {
        transactions = parseOfx(content);
      } else {
        transactions = parseCsv(content, {
          delimiter: dto.delimiter,
          decimalSeparator: dto.decimalSeparator,
          dateFormat: dto.dateFormat as CsvDateFormat | undefined,
          hasHeader: dto.hasHeader,
          dateColumn: dto.dateColumn!,
          amountColumn: dto.amountColumn!,
          descriptionColumn: dto.descriptionColumn!,
          typeColumn: dto.typeColumn,
        });
      }
    } catch (err: any) {
      throw new BadRequestException(err?.message ?? 'Falha ao ler o arquivo.');
    }

    const totalIncome = transactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((s, t) => s + t.amount, 0);

    return {
      format: dto.format,
      count: transactions.length,
      summary: {
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
        firstDate: transactions[0]?.date ?? null,
        lastDate: transactions[transactions.length - 1]?.date ?? null,
      },
      transactions,
    };
  }

  /**
   * Persiste em lote as transações confirmadas (source=IMPORTED), pulando
   * duplicatas (mesma conta+data+valor+tipo+descrição já existentes ou repetidas
   * no próprio lote) e atualizando o saldo da conta uma única vez.
   */
  async confirm(userId: string, dto: ConfirmImportDto) {
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account) throw new NotFoundException('Conta não encontrada');
    if (account.userId !== userId) {
      throw new ForbiddenException('Você não tem permissão para usar esta conta');
    }

    // Janela de datas do lote, para buscar possíveis duplicatas existentes.
    const dates = dto.transactions.map((t) => new Date(t.date));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    maxDate.setHours(23, 59, 59, 999);

    const existing = await this.prisma.transaction.findMany({
      where: {
        userId,
        accountId: dto.accountId,
        date: { gte: minDate, lte: maxDate },
      },
      select: { date: true, amount: true, type: true, description: true },
    });

    const seen = new Set<string>(
      existing.map((t) =>
        this.dedupKey(
          t.date.toISOString().slice(0, 10),
          Number(t.amount),
          t.type,
          t.description,
        ),
      ),
    );

    const toCreate: ParsedTx[] = [];
    let skipped = 0;
    for (const t of dto.transactions) {
      const key = this.dedupKey(t.date, t.amount, t.type, t.description);
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key); // evita duplicatas dentro do próprio lote
      toCreate.push(t);
    }

    if (toCreate.length === 0) {
      return { imported: 0, skipped, message: 'Nenhuma transação nova para importar.' };
    }

    await this.prisma.transaction.createMany({
      data: toCreate.map((t) => ({
        userId,
        accountId: dto.accountId,
        type: t.type,
        amount: t.amount,
        description: t.description,
        date: new Date(t.date),
        source: 'IMPORTED' as const,
        status: 'COMPLETED' as const,
      })),
    });

    // Atualiza o saldo da conta uma única vez com o delta líquido.
    const netDelta = toCreate.reduce(
      (sum, t) => sum + (t.type === TransactionType.INCOME ? t.amount : -t.amount),
      0,
    );
    const previousBalance = Number(account.currentBalance);
    const newBalance = previousBalance + netDelta;
    await this.prisma.account.update({
      where: { id: dto.accountId },
      data: { currentBalance: newBalance },
    });

    await this.cacheService.invalidateUserCache(userId);
    this.websocketService.emitToUser(userId, WS_EVENTS.BALANCE_UPDATED, {
      accountId: dto.accountId,
      previousBalance,
      newBalance,
      difference: netDelta,
    });

    this.logger.log(
      `Import: usuário ${userId} importou ${toCreate.length}, pulou ${skipped} na conta ${dto.accountId}`,
    );

    return { imported: toCreate.length, skipped };
  }

  private dedupKey(
    date: string,
    amount: number,
    type: TransactionType,
    description: string,
  ): string {
    return `${date}|${amount.toFixed(2)}|${type}|${description.trim().toLowerCase()}`;
  }
}
