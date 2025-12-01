import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';
import { FilterRecurringTransactionDto } from './dto/filter-recurring-transaction.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, RecurrenceFrequency } from '@prisma/client';

@Injectable()
export class RecurringTransactionsService {
  private readonly logger = new Logger(RecurringTransactionsService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, createDto: CreateRecurringTransactionDto) {
    // Validar conta
    const account = await this.prisma.account.findUnique({
      where: { id: createDto.accountId },
    });

    if (!account || account.userId !== userId) {
      throw new NotFoundException('Conta não encontrada');
    }

    // Validar categoria (se fornecida)
    if (createDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: createDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Categoria não encontrada');
      }
    }

    // Validar datas
    const startDate = new Date(createDto.startDate);
    const endDate = createDto.endDate ? new Date(createDto.endDate) : null;

    if (endDate && endDate <= startDate) {
      throw new BadRequestException(
        'Data final deve ser posterior à data inicial',
      );
    }

    // Validar campos obrigatórios por frequência
    if (createDto.frequency === 'MONTHLY' || createDto.frequency === 'YEARLY') {
      if (!createDto.dayOfMonth) {
        throw new BadRequestException(
          `dayOfMonth é obrigatório para frequência ${createDto.frequency}`,
        );
      }
    }

    if (createDto.frequency === 'WEEKLY') {
      if (createDto.dayOfWeek === undefined) {
        throw new BadRequestException(
          'dayOfWeek é obrigatório para frequência WEEKLY',
        );
      }
    }

    // Calcular primeira ocorrência
    const nextOccurrence = this.calculateNextOccurrence(
      startDate,
      createDto.frequency,
      createDto.interval || 1,
      createDto.dayOfMonth,
      createDto.dayOfWeek,
    );

    return this.prisma.recurringTransaction.create({
      data: {
        userId,
        accountId: createDto.accountId,
        categoryId: createDto.categoryId,
        type: createDto.type,
        amount: createDto.amount,
        description: createDto.description,
        merchant: createDto.merchant,
        frequency: createDto.frequency,
        interval: createDto.interval || 1,
        dayOfMonth: createDto.dayOfMonth,
        dayOfWeek: createDto.dayOfWeek,
        startDate,
        endDate,
        nextOccurrence,
        autoCreate: createDto.autoCreate ?? true,
        tags: createDto.tags || [],
        notes: createDto.notes,
        isActive: true,
      },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      },
    });
  }

  async findAll(userId: string, filters: FilterRecurringTransactionDto) {
    const where: Prisma.RecurringTransactionWhereInput = {
      userId,
      ...(filters.type && { type: filters.type }),
      ...(filters.frequency && { frequency: filters.frequency }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    };

    return this.prisma.recurringTransaction.findMany({
      where,
      include: {
        account: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
        _count: {
          select: {
            generatedTransactions: true,
          },
        },
      },
      orderBy: {
        nextOccurrence: 'asc',
      },
    });
  }

  async findOne(id: string, userId: string) {
    const recurring = await this.prisma.recurringTransaction.findUnique({
      where: { id },
      include: {
        account: true,
        category: true,
        generatedTransactions: {
          orderBy: {
            date: 'desc',
          },
          take: 20,
        },
        _count: {
          select: {
            generatedTransactions: true,
          },
        },
      },
    });

    if (!recurring) {
      throw new NotFoundException('Transação recorrente não encontrada');
    }

    if (recurring.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este recurso',
      );
    }

    return recurring;
  }

  async update(
    id: string,
    userId: string,
    updateDto: UpdateRecurringTransactionDto,
  ) {
    const existing = await this.findOne(id, userId);

    // Se mudou a frequência ou intervalo, recalcular nextOccurrence
    let nextOccurrence = existing.nextOccurrence;

    if (
      updateDto.frequency ||
      updateDto.interval ||
      updateDto.dayOfMonth ||
      updateDto.dayOfWeek ||
      updateDto.startDate
    ) {
      const frequency = updateDto.frequency || existing.frequency;
      const interval = updateDto.interval || existing.interval;
      const dayOfMonth = updateDto.dayOfMonth ?? existing.dayOfMonth;
      const dayOfWeek = updateDto.dayOfWeek ?? existing.dayOfWeek;
      const startDate = updateDto.startDate
        ? new Date(updateDto.startDate)
        : existing.startDate;

      nextOccurrence = this.calculateNextOccurrence(
        startDate,
        frequency,
        interval,
        dayOfMonth,
        dayOfWeek,
      );
    }

    return this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        ...updateDto,
        ...(updateDto.startDate && {
          startDate: new Date(updateDto.startDate),
        }),
        ...(updateDto.endDate && { endDate: new Date(updateDto.endDate) }),
        nextOccurrence,
      },
      include: {
        account: true,
        category: true,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    await this.prisma.recurringTransaction.delete({
      where: { id },
    });

    return { message: 'Transação recorrente deletada com sucesso' };
  }

  async toggleActive(id: string, userId: string) {
    const recurring = await this.findOne(id, userId);

    const updated = await this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        isActive: !recurring.isActive,
      },
    });

    return {
      message: `Transação recorrente ${updated.isActive ? 'ativada' : 'desativada'}`,
      isActive: updated.isActive,
    };
  }

  async processNow(id: string, userId: string) {
    const recurring = await this.findOne(id, userId);

    if (!recurring.isActive) {
      throw new BadRequestException('Transação recorrente está inativa');
    }

    const transaction = await this.generateTransaction(recurring);

    return {
      message: 'Transação gerada com sucesso',
      transaction,
    };
  }

  // ==================== JOB AUTOMÁTICO ====================

  /**
   * Processa transações recorrentes (roda todo dia às 6h da manhã)
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async processRecurringTransactions() {
    this.logger.log('🔁 Processando transações recorrentes...');

    const now = new Date();

    // Buscar todas as recorrências ativas com nextOccurrence <= hoje
    const recurringDue = await this.prisma.recurringTransaction.findMany({
      where: {
        isActive: true,
        autoCreate: true,
        nextOccurrence: {
          lte: now,
        },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: {
        account: true,
        category: true,
      },
    });

    this.logger.log(
      `📋 Encontradas ${recurringDue.length} transações para processar`,
    );

    let successCount = 0;
    let errorCount = 0;

    for (const recurring of recurringDue) {
      try {
        await this.generateTransaction(recurring);
        successCount++;
      } catch (error) {
        errorCount++;
        this.logger.error(
          `Erro ao processar recorrência ${recurring.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `✅ Processamento concluído: ${successCount} sucesso, ${errorCount} erros`,
    );
  }

  // ==================== MÉTODOS AUXILIARES ====================

  private async generateTransaction(recurring: any) {
    // Criar transação
    const transaction = await this.prisma.transaction.create({
      data: {
        userId: recurring.userId,
        accountId: recurring.accountId,
        categoryId: recurring.categoryId,
        type: recurring.type,
        amount: recurring.amount,
        description: recurring.description,
        merchant: recurring.merchant,
        date: recurring.nextOccurrence,
        tags: recurring.tags,
        notes: recurring.notes,
        source: 'MANUAL',
        status: 'COMPLETED',
        recurringTransactionId: recurring.id,
      },
      include: {
        account: true,
        category: true,
      },
    });

    // Atualizar saldo da conta
    await this.updateAccountBalance(
      recurring.accountId,
      recurring.type,
      Number(recurring.amount),
    );

    // Calcular próxima ocorrência
    const nextOccurrence = this.calculateNextOccurrence(
      recurring.nextOccurrence,
      recurring.frequency,
      recurring.interval,
      recurring.dayOfMonth,
      recurring.dayOfWeek,
    );

    // Verificar se passou da data final
    const shouldDeactivate =
      recurring.endDate && nextOccurrence > new Date(recurring.endDate);

    // Atualizar recorrência
    await this.prisma.recurringTransaction.update({
      where: { id: recurring.id },
      data: {
        lastProcessedDate: new Date(),
        nextOccurrence: shouldDeactivate
          ? recurring.nextOccurrence
          : nextOccurrence,
        isActive: shouldDeactivate ? false : recurring.isActive,
      },
    });

    this.logger.log(
      `✓ Transação gerada: ${transaction.description} - R$ ${transaction.amount}`,
    );

    return transaction;
  }

  private calculateNextOccurrence(
    baseDate: Date,
    frequency: RecurrenceFrequency,
    interval: number,
    dayOfMonth?: number,
    dayOfWeek?: number,
  ): Date {
    const next = new Date(baseDate);

    switch (frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + interval);
        break;

      case 'WEEKLY':
        next.setDate(next.getDate() + 7 * interval);
        // Ajustar para o dia da semana correto
        if (dayOfWeek !== undefined) {
          const currentDay = next.getDay();
          const diff = (dayOfWeek - currentDay + 7) % 7;
          next.setDate(next.getDate() + diff);
        }
        break;

      case 'MONTHLY':
        next.setMonth(next.getMonth() + interval);
        // Ajustar para o dia do mês correto
        if (dayOfMonth) {
          next.setDate(Math.min(dayOfMonth, this.getDaysInMonth(next)));
        }
        break;

      case 'YEARLY':
        next.setFullYear(next.getFullYear() + interval);
        // Ajustar para o dia do mês correto
        if (dayOfMonth) {
          next.setDate(Math.min(dayOfMonth, this.getDaysInMonth(next)));
        }
        break;
    }

    // Garantir que a próxima ocorrência é no futuro
    const now = new Date();
    while (next <= now) {
      return this.calculateNextOccurrence(
        next,
        frequency,
        interval,
        dayOfMonth,
        dayOfWeek,
      );
    }

    return next;
  }

  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  private async updateAccountBalance(
    accountId: string,
    type: string,
    amount: number,
  ) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) return;

    let newBalance = Number(account.currentBalance);

    if (type === 'INCOME') {
      newBalance += amount;
    } else if (type === 'EXPENSE') {
      newBalance -= amount;
    }

    await this.prisma.account.update({
      where: { id: accountId },
      data: { currentBalance: newBalance },
    });
  }
}
