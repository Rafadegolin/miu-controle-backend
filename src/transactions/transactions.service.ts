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
import { CacheService } from '../common/services/cache.service';
import { WebsocketService } from '../websocket/websocket.service';
import { WS_EVENTS } from '../websocket/events/websocket.events';
import { AiCategorizationService } from '../ai/services/ai-categorization.service';

import { BrandsService } from '../brands/brands.service';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
    private websocketService: WebsocketService,
    private aiCategorizationService: AiCategorizationService,
    private brandsService: BrandsService,
  ) {}

  async create(userId: string, createTransactionDto: CreateTransactionDto) {
    // ... existing validation code ...
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

    // 🧠 BRAND INTELLIGENCE: Detect brand from description
    let brandId: string | null = null;
    try {
      const detectedBrand = await this.brandsService.detectBrand(
        createTransactionDto.description,
      );
      if (detectedBrand) {
        brandId = detectedBrand.id;
      }
    } catch (e) {
      console.warn('Brand detection failed:', e);
    }

    // 🤖 AI CATEGORIZATION
    let aiCategoryId: string | null = null;
    let aiConfidence: number | null = null;
    let aiCategorized = false;

    if (!createTransactionDto.categoryId) {
      // ... ai logic ...
      try {
        const aiResult =
          await this.aiCategorizationService.categorizeTransaction(userId, {
            description: createTransactionDto.description,
            amount: createTransactionDto.amount,
            merchant: createTransactionDto.merchant,
            date: createTransactionDto.date
              ? new Date(createTransactionDto.date)
              : new Date(),
          });

        // Aplicar categoria se confiança >= 0.7
        if (aiResult.categoryId && aiResult.confidence >= 0.7) {
          aiCategoryId = aiResult.categoryId;
          aiConfidence = aiResult.confidence;
          aiCategorized = true;

          const suggestedCategory = await this.prisma.category.findUnique({
            where: { id: aiResult.categoryId },
          });

          if (
            suggestedCategory &&
            suggestedCategory.type === createTransactionDto.type
          ) {
            createTransactionDto.categoryId = aiResult.categoryId;
          } else {
            aiCategorized = false;
          }
        }
      } catch (error) {
        console.warn('AI categorization failed:', error.message);
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
        brandId, // <--- Added brandId
        date: createTransactionDto.date
          ? new Date(createTransactionDto.date)
          : new Date(),
        isRecurring: createTransactionDto.isRecurring || false,
        recurrencePattern: createTransactionDto.recurrencePattern,
        tags: createTransactionDto.tags || [],
        notes: createTransactionDto.notes,
        source: createTransactionDto.source || 'MANUAL',
        status: 'COMPLETED',
        // AI fields
        aiCategorized,
        aiConfidence: aiConfidence !== null ? aiConfidence : undefined,
      },
      include: {
        category: true,
        account: true,
        brand: true, // <--- Include brand
      },
    });

    // ... balance update ...
    await this.updateAccountBalance(
      createTransactionDto.accountId,
      createTransactionDto.type,
      createTransactionDto.amount,
      'ADD',
    );

    // ... cache invalidate ...
    await this.cacheService.invalidateUserCache(userId);

    // ... websocket ...
    this.websocketService.emitToUser(userId, WS_EVENTS.TRANSACTION_CREATED, {
      transactionId: transaction.id,
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      brand: transaction.brand, // <--- Emit brand
      type: transaction.type,
      amount: Number(transaction.amount),
      description: transaction.description,
      date: transaction.date,
      aiCategorized: transaction.aiCategorized,
      aiConfidence: transaction.aiConfidence
        ? Number(transaction.aiConfidence)
        : null,
    });

    return transaction;
  }

  async findAll(userId: string, filters: FilterTransactionDto) {
    // ... setup ...
    const take = filters.take || 50; // Default 50
    const cursor = filters.cursor;

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

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.date.lte = new Date(filters.endDate);
      }
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      take: take + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      select: {
        id: true,
        amount: true,
        description: true,
        merchant: true,
        brand: { select: { id: true, name: true, logoUrl: true, slug: true } }, // <--- Select Brand
        date: true,
        type: true,
        status: true,
        tags: true,
        notes: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            type: true,
          },
        },
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
    // ...
    // Verify count and return
    const hasMore = transactions.length > take;
    const items = hasMore ? transactions.slice(0, take) : transactions;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async findOne(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        category: true,
        account: true,
        brand: true,
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

    const updated = await this.prisma.transaction.update({
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

    // Invalidar cache do usuário
    await this.cacheService.invalidateUserCache(userId);

    // Emitir evento WebSocket
    this.websocketService.emitToUser(userId, WS_EVENTS.TRANSACTION_UPDATED, {
      transactionId: updated.id,
      accountId: updated.accountId,
      categoryId: updated.categoryId,
      type: updated.type,
      amount: Number(updated.amount),
      description: updated.description,
      date: updated.date,
    });

    return updated;
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

    // Invalidar cache do usuário
    await this.cacheService.invalidateUserCache(userId);

    // Emitir evento WebSocket
    this.websocketService.emitToUser(userId, WS_EVENTS.TRANSACTION_DELETED, {
      transactionId: id,
      accountId: transaction.accountId,
    });

    return { message: 'Transação deletada com sucesso' };
  }

  // ==================== ANALYTICS ====================

  async getMonthlyStats(userId: string, month: string) {
    // Usar Date.UTC para evitar bugs de timezone com strings de data pura ("YYYY-MM-DD")
    // new Date("2026-02-01") é UTC, mas setMonth() opera no fuso local → resultado errado em UTC-3
    const parts = month.split('T')[0].split('-'); // aceita "2026-02-01" ou "2026-02-01T..."
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1; // 0-indexed
    const startDate = new Date(Date.UTC(year, monthIndex, 1));
    const endDate = new Date(Date.UTC(year, monthIndex + 1, 1));

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

  /**
   * 🤖 AI FEEDBACK: Correct category suggested by AI
   */
  async correctCategory(
    transactionId: string,
    userId: string,
    correctedCategoryId: string,
  ) {
    // 1. Find transaction and validate ownership
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { category: true },
    });

    if (!transaction) {
      throw new NotFoundException('Transação não encontrada');
    }

    if (transaction.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para modificar esta transação',
      );
    }

    // 2. Validate corrected category exists
    const correctedCategory = await this.prisma.category.findUnique({
      where: { id: correctedCategoryId },
    });

    if (!correctedCategory) {
      throw new NotFoundException('Categoria corrigida não encontrada');
    }

    // 3. Check if category type matches transaction type
    if (correctedCategory.type !== transaction.type) {
      throw new BadRequestException(
        `Categoria do tipo ${correctedCategory.type} não pode ser usada em transação do tipo ${transaction.type}`,
      );
    }

    // 4. Save feedback (only if was AI categorized)
    if (transaction.aiCategorized && transaction.categoryId) {
      const wasCorrect = transaction.categoryId === correctedCategoryId;

      await this.prisma.aiCategorizationFeedback.create({
        data: {
          userId,
          transactionId,
          originalCategoryId: transaction.categoryId,
          correctedCategoryId,
          aiConfidence: transaction.aiConfidence || 0,
          wasCorrect,
        },
      });
    }

    // 5. Update transaction with corrected category
    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        categoryId: correctedCategoryId,
        aiCategorized: false, // Mark as manually corrected
      },
      include: {
        category: true,
        account: true,
      },
    });

    // 6. Invalidar cache
    await this.cacheService.invalidateUserCache(userId);

    // 7. Emit WebSocket event
    this.websocketService.emitToUser(userId, WS_EVENTS.TRANSACTION_UPDATED, {
      transactionId: updatedTransaction.id,
      categoryId: updatedTransaction.categoryId,
      aiCategorized: updatedTransaction.aiCategorized,
    });

    return {
      message: 'Categoria corrigida com sucesso',
      transaction: updatedTransaction,
      feedbackSaved: transaction.aiCategorized,
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

    const previousBalance = Number(account.currentBalance);

    const updatedAccount = await this.prisma.account.update({
      where: { id: accountId },
      data: { currentBalance: newBalance },
    });

    // Emitir evento de saldo atualizado
    this.websocketService.emitToUser(
      account.userId,
      WS_EVENTS.BALANCE_UPDATED,
      {
        accountId,
        previousBalance,
        newBalance: Number(updatedAccount.currentBalance),
        difference: Number(updatedAccount.currentBalance) - previousBalance,
      },
    );
  }
}
