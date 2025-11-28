import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetPeriod } from '@prisma/client';

@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createBudgetDto: CreateBudgetDto) {
    // Validar se categoria existe
    const category = await this.prisma.category.findUnique({
      where: { id: createBudgetDto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    // Validar se categoria pertence ao usuário ou é do sistema
    if (category.userId && category.userId !== userId) {
      throw new ForbiddenException(
        'Você não pode criar orçamento para esta categoria',
      );
    }

    const startDate = new Date(createBudgetDto.startDate);
    const endDate = createBudgetDto.endDate
      ? new Date(createBudgetDto.endDate)
      : null;

    // Validar datas
    if (endDate && endDate < startDate) {
      throw new BadRequestException(
        'Data de fim não pode ser anterior à data de início',
      );
    }

    // Verificar se já existe orçamento para essa categoria no mesmo período
    const existingBudget = await this.prisma.budget.findFirst({
      where: {
        userId,
        categoryId: createBudgetDto.categoryId,
        period: createBudgetDto.period,
        startDate,
      },
    });

    if (existingBudget) {
      throw new ConflictException(
        'Já existe um orçamento para esta categoria no período selecionado',
      );
    }

    return this.prisma.budget.create({
      data: {
        userId,
        categoryId: createBudgetDto.categoryId,
        amount: createBudgetDto.amount,
        period: createBudgetDto.period,
        startDate,
        endDate,
        alertPercentage: createBudgetDto.alertPercentage || 80,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            icon: true,
          },
        },
      },
    });
  }

  async findAll(userId: string, period?: BudgetPeriod) {
    const where: any = { userId };

    if (period) {
      where.period = period;
    }

    const budgets = await this.prisma.budget.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            icon: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    // Calcular status de cada orçamento
    return Promise.all(
      budgets.map(async (budget) => {
        const spent = await this.calculateSpent(
          userId,
          budget.categoryId,
          budget.startDate,
          budget.endDate,
        );
        const percentage = (spent / Number(budget.amount)) * 100;
        const status = this.getBudgetStatus(percentage, budget.alertPercentage);

        return {
          ...budget,
          spent,
          remaining: Number(budget.amount) - spent,
          percentage: Math.round(percentage * 100) / 100,
          status,
        };
      }),
    );
  }

  async findOne(id: string, userId: string) {
    const budget = await this.prisma.budget.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            icon: true,
          },
        },
      },
    });

    if (!budget) {
      throw new NotFoundException('Orçamento não encontrado');
    }

    if (budget.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este orçamento',
      );
    }

    // Calcular gastos
    const spent = await this.calculateSpent(
      userId,
      budget.categoryId,
      budget.startDate,
      budget.endDate,
    );
    const percentage = (spent / Number(budget.amount)) * 100;
    const status = this.getBudgetStatus(percentage, budget.alertPercentage);

    // Buscar transações do período
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        categoryId: budget.categoryId,
        date: {
          gte: budget.startDate,
          ...(budget.endDate && { lte: budget.endDate }),
        },
        status: 'COMPLETED',
      },
      orderBy: {
        date: 'desc',
      },
      take: 20,
    });

    return {
      ...budget,
      spent,
      remaining: Number(budget.amount) - spent,
      percentage: Math.round(percentage * 100) / 100,
      status,
      transactions,
    };
  }

  async update(id: string, userId: string, updateBudgetDto: UpdateBudgetDto) {
    const budget = await this.findOne(id, userId);

    // Validar categoria se mudando
    if (updateBudgetDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateBudgetDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Categoria não encontrada');
      }

      if (category.userId && category.userId !== userId) {
        throw new ForbiddenException('Você não pode usar esta categoria');
      }
    }

    // Validar datas se mudando
    if (updateBudgetDto.startDate || updateBudgetDto.endDate) {
      const startDate = updateBudgetDto.startDate
        ? new Date(updateBudgetDto.startDate)
        : budget.startDate;
      const endDate = updateBudgetDto.endDate
        ? new Date(updateBudgetDto.endDate)
        : budget.endDate;

      if (endDate && endDate < startDate) {
        throw new BadRequestException(
          'Data de fim não pode ser anterior à data de início',
        );
      }
    }

    return this.prisma.budget.update({
      where: { id },
      data: {
        ...updateBudgetDto,
        startDate: updateBudgetDto.startDate
          ? new Date(updateBudgetDto.startDate)
          : undefined,
        endDate: updateBudgetDto.endDate
          ? new Date(updateBudgetDto.endDate)
          : undefined,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
            icon: true,
          },
        },
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    await this.prisma.budget.delete({ where: { id } });

    return { message: 'Orçamento deletado com sucesso' };
  }

  async getSummary(userId: string, month?: string) {
    const date = month ? new Date(month) : new Date();
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const budgets = await this.prisma.budget.findMany({
      where: {
        userId,
        period: 'MONTHLY',
        startDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
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

    const summary = await Promise.all(
      budgets.map(async (budget) => {
        const spent = await this.calculateSpent(
          userId,
          budget.categoryId,
          budget.startDate,
          budget.endDate,
        );
        const percentage = (spent / Number(budget.amount)) * 100;
        const status = this.getBudgetStatus(percentage, budget.alertPercentage);

        return {
          id: budget.id,
          category: budget.category,
          budgeted: Number(budget.amount),
          spent,
          remaining: Number(budget.amount) - spent,
          percentage: Math.round(percentage * 100) / 100,
          status,
        };
      }),
    );

    const totalBudgeted = summary.reduce((sum, b) => sum + b.budgeted, 0);
    const totalSpent = summary.reduce((sum, b) => sum + b.spent, 0);

    return {
      period: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      totalBudgeted,
      totalSpent,
      totalRemaining: totalBudgeted - totalSpent,
      overallPercentage:
        Math.round((totalSpent / totalBudgeted) * 100 * 100) / 100,
      budgets: summary,
    };
  }

  // ==================== MÉTODOS AUXILIARES ====================

  private async calculateSpent(
    userId: string,
    categoryId: string,
    startDate: Date,
    endDate?: Date,
  ): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      where: {
        userId,
        categoryId,
        type: 'EXPENSE',
        status: 'COMPLETED',
        date: {
          gte: startDate,
          ...(endDate && { lte: endDate }),
        },
      },
      _sum: {
        amount: true,
      },
    });

    return Number(result._sum.amount || 0);
  }

  private getBudgetStatus(percentage: number, alertPercentage: number): string {
    if (percentage >= 100) return 'EXCEEDED'; // Vermelho
    if (percentage >= alertPercentage) return 'WARNING'; // Amarelo
    return 'OK'; // Verde
  }
}
