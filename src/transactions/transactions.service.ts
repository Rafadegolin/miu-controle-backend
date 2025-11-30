import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FilterTransactionDto } from './dto/filter-transaction.dto';
import {
  Prisma,
  TransactionType,
  TransactionStatus,
  TransactionSource,
} from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createTransactionDto: CreateTransactionDto) {
    // Validar se a conta existe e pertence ao usuário
    const account = await this.prisma.account.findUnique({
      where: { id: createTransactionDto.accountId },
    });

    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }

    if (account.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para usar esta conta',
      );
    }

    // Validar se a categoria existe (se fornecida)
    if (createTransactionDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: createTransactionDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Categoria não encontrada');
      }

      // Verificar se o tipo da transação bate com o tipo da categoria
      if (category.type !== createTransactionDto.type) {
        throw new BadRequestException(
          `Categoria do tipo ${category.type} não pode ser usada em transação do tipo ${createTransactionDto.type}`,
        );
      }
    }

    // Criar transação
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        accountId: createTransactionDto.accountId,
        categoryId: createTransactionDto.categoryId,
        type: createTransactionDto.type,
        amount: createTransactionDto.amount,
        description: createTransactionDto.description,
        merchant: createTransactionDto.merchant,
        date: createTransactionDto.date
          ? new Date(createTransactionDto.date)
          : new Date(),
        isRecurring: createTransactionDto.isRecurring || false,
        recurrencePattern: createTransactionDto.recurrencePattern,
        tags: createTransactionDto.tags || [],
        notes: createTransactionDto.notes,
        source: createTransactionDto.source || 'MANUAL',
        status: 'COMPLETED',
      },
      include: {
        category: true,
        account: true,
      },
    });

    // Atualizar saldo da conta
    await this.updateAccountBalance(
      createTransactionDto.accountId,
      createTransactionDto.type,
      createTransactionDto.amount,
      'ADD',
    );

    return transaction;
  }

  async findAll(userId: string, filters: FilterTransactionDto) {
    const where: Prisma.TransactionWhereInput = {
      userId,
      ...(filters.type && { type: filters.type }),
      ...(filters.categoryId && { categoryId: filters.categoryId }),
      ...(filters.accountId && { accountId: filters.accountId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.search && {
        OR: [
          { description: { contains: filters.search, mode: 'insensitive' } },
          { merchant: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    // Filtro de data
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.date.lte = new Date(filters.endDate);
      }
    }

    return this.prisma.transaction.findMany({
      where,
      include: {
        category: true,
        account: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  async findOne(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        category: true,
        account: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    if (transaction.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar esta transação',
      );
    }

    return transaction;
  }

  async update(
    id: string,
    userId: string,
    updateTransactionDto: UpdateTransactionDto,
  ) {
    const existingTransaction = await this.findOne(id, userId);

    // Se mudou o valor ou tipo, reverter saldo antigo e aplicar novo
    if (
      updateTransactionDto.amount !== undefined ||
      updateTransactionDto.type !== undefined
    ) {
      // Reverter saldo antigo
      await this.updateAccountBalance(
        existingTransaction.accountId,
        existingTransaction.type,
        Number(existingTransaction.amount),
        'REMOVE',
      );

      // Aplicar novo saldo
      const newAmount =
        updateTransactionDto.amount ?? Number(existingTransaction.amount);
      const newType = updateTransactionDto.type ?? existingTransaction.type;

      await this.updateAccountBalance(
        existingTransaction.accountId,
        newType,
        newAmount,
        'ADD',
      );
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        ...updateTransactionDto,
        date: updateTransactionDto.date
          ? new Date(updateTransactionDto.date)
          : undefined,
      },
      include: {
        category: true,
        account: true,
      },
    });
  }

  async remove(id: string, userId: string) {
    const transaction = await this.findOne(id, userId);

    // Reverter saldo
    await this.updateAccountBalance(
      transaction.accountId,
      transaction.type,
      Number(transaction.amount),
      'REMOVE',
    );

    await this.prisma.transaction.delete({
      where: { id },
    });

    return { message: 'Transação deletada com sucesso' };
  }

  // ==================== ANALYTICS ====================

  async getMonthlyStats(userId: string, month: string) {
    const startDate = new Date(month);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lt: endDate,
        },
        status: 'COMPLETED',
      },
      include: {
        category: true,
      },
    });

    const income = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Agrupar por categoria
    const byCategory = transactions
      .filter((t) => t.category)
      .reduce((acc, t) => {
        const catName = t.category.name;
        if (!acc[catName]) {
          acc[catName] = {
            name: catName,
            color: t.category.color,
            icon: t.category.icon,
            total: 0,
            count: 0,
          };
        }
        acc[catName].total += Number(t.amount);
        acc[catName].count += 1;
        return acc;
      }, {});

    return {
      period: month,
      income,
      expenses,
      balance: income - expenses,
      transactionCount: transactions.length,
      categoryBreakdown: Object.values(byCategory),
      recentTransactions: transactions.slice(0, 10),
    };
  }

  async getCategoryStats(
    userId: string,
    categoryId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const where: Prisma.TransactionWhereInput = {
      userId,
      categoryId,
      status: 'COMPLETED',
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    const total = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const average = transactions.length > 0 ? total / transactions.length : 0;

    return {
      categoryId,
      total,
      average,
      count: transactions.length,
      transactions: transactions.slice(0, 20),
    };
  }

  // ==================== MÉTODOS AUXILIARES ====================

  private async updateAccountBalance(
    accountId: string,
    type: string,
    amount: number,
    operation: 'ADD' | 'REMOVE',
  ) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) return;

    let newBalance = Number(account.currentBalance);

    if (operation === 'ADD') {
      if (type === 'INCOME') {
        newBalance += amount;
      } else if (type === 'EXPENSE') {
        newBalance -= amount;
      }
    } else {
      // REMOVE (reverter)
      if (type === 'INCOME') {
        newBalance -= amount;
      } else if (type === 'EXPENSE') {
        newBalance += amount;
      }
    }

    await this.prisma.account.update({
      where: { id: accountId },
      data: { currentBalance: newBalance },
    });
  }
}
