import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DashboardResponseDto,
  AccountsSummaryDto,
  CurrentMonthSummaryDto,
  GoalsSummaryDto,
  BudgetsSummaryDto,
  UpcomingRecurringDto,
  NotificationsSummaryDto,
  ImportantDateDto,
  InsightDto,
  MonthComparisonDto,
} from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Dashboard completo para tela inicial
   */
  async getHomeDashboard(userId: string): Promise<DashboardResponseDto> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Buscar todos os dados em paralelo para otimizar performance
    const [
      accountsSummary,
      currentMonthData,
      lastMonthData,
      goals,
      budgets,
      upcomingRecurring,
      notifications,
    ] = await Promise.all([
      this.getAccountsSummary(userId),
      this.getMonthTransactions(userId, startOfMonth, endOfMonth),
      this.getMonthTransactions(userId, startOfLastMonth, endOfLastMonth),
      this.getGoalsSummary(userId),
      this.getBudgetsSummary(userId, startOfMonth, endOfMonth),
      this.getUpcomingRecurring(userId),
      this.getNotificationsSummary(userId),
    ]);

    // Processar dados do mês atual
    const currentMonth = this.processCurrentMonth(currentMonthData, lastMonthData, now);

    // Gerar datas importantes
    const importantDates = this.generateImportantDates(
      upcomingRecurring,
      goals.active,
      budgets.items,
    );

    // Gerar insights inteligentes
    const insights = this.generateInsights(
      accountsSummary,
      currentMonth,
      goals,
      budgets,
    );

    return {
      accountsSummary,
      currentMonth,
      goals,
      budgets,
      upcomingRecurring: upcomingRecurring.slice(0, 10), // Limitar a 10 próximas
      notifications,
      importantDates: importantDates.slice(0, 15), // Limitar a 15 próximas datas
      insights,
      generatedAt: now,
    };
  }

  // ==================== ACCOUNTS SUMMARY ====================
  private async getAccountsSummary(userId: string): Promise<AccountsSummaryDto> {
    const accounts = await this.prisma.account.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        currentBalance: 'desc',
      },
    });

    const totalBalance = accounts.reduce(
      (sum, acc) => sum + Number(acc.currentBalance),
      0,
    );

    return {
      totalBalance: Math.round(totalBalance * 100) / 100,
      activeAccountsCount: accounts.length,
      accounts: accounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        currentBalance: Number(acc.currentBalance),
        type: acc.type,
        currency: acc.currency,
        color: acc.color,
        icon: acc.icon || undefined,
      })),
    };
  }

  // ==================== CURRENT MONTH ====================
  private async getMonthTransactions(
    userId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        status: 'COMPLETED',
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const income = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expense = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      income,
      expense,
      balance: income - expense,
      transactionCount: transactions.length,
      startDate,
      endDate,
    };
  }

  private processCurrentMonth(
    currentData: any,
    lastData: any,
    now: Date,
  ): CurrentMonthSummaryDto {
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const avgDailyExpense = currentData.expense / daysInMonth;

    // Calcular mudanças percentuais
    const incomeChange =
      lastData.income > 0
        ? ((currentData.income - lastData.income) / lastData.income) * 100
        : 0;

    const expenseChange =
      lastData.expense > 0
        ? ((currentData.expense - lastData.expense) / lastData.expense) * 100
        : 0;

    const balanceChange =
      lastData.balance !== 0
        ? ((currentData.balance - lastData.balance) / Math.abs(lastData.balance)) * 100
        : 0;

    const comparison: MonthComparisonDto = {
      incomeChange: Math.round(incomeChange * 10) / 10,
      expenseChange: Math.round(expenseChange * 10) / 10,
      balanceChange: Math.round(balanceChange * 10) / 10,
    };

    return {
      income: Math.round(currentData.income * 100) / 100,
      expense: Math.round(currentData.expense * 100) / 100,
      balance: Math.round(currentData.balance * 100) / 100,
      transactionCount: currentData.transactionCount,
      avgDailyExpense: Math.round(avgDailyExpense * 100) / 100,
      comparisonWithLastMonth: comparison,
    };
  }

  // ==================== GOALS ====================
  private async getGoalsSummary(userId: string): Promise<GoalsSummaryDto> {
    const goals = await this.prisma.goal.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      orderBy: {
        targetDate: 'asc',
      },
    });

    const now = new Date();

    const goalsWithProgress = goals.map((goal) => {
      const progress = Number(goal.targetAmount) > 0
        ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100
        : 0;

      const daysRemaining = goal.targetDate
        ? Math.ceil(
            (new Date(goal.targetDate).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : undefined;

      return {
        id: goal.id,
        name: goal.name,
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
        progress: Math.round(progress * 10) / 10,
        targetDate: goal.targetDate || undefined,
        daysRemaining,
        color: goal.color,
        icon: goal.icon || undefined,
        status: goal.status,
      };
    });

    const nearCompletion = goalsWithProgress.filter((g) => g.progress >= 80);

    return {
      active: goalsWithProgress,
      nearCompletion,
      totalActiveGoals: goalsWithProgress.length,
    };
  }

  // ==================== BUDGETS ====================
  private async getBudgetsSummary(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<BudgetsSummaryDto> {
    // Buscar orçamentos do período atual
    const budgets = await this.prisma.budget.findMany({
      where: {
        userId,
        period: 'MONTHLY',
        startDate: {
          lte: endDate,
        },
        OR: [
          { endDate: null },
          { endDate: { gte: startDate } },
        ],
      },
      include: {
        category: true,
      },
    });

    // Para cada orçamento, calcular quanto foi gasto
    const budgetsWithSpent = await Promise.all(
      budgets.map(async (budget) => {
        const spent = await this.prisma.transaction.aggregate({
          where: {
            userId,
            categoryId: budget.categoryId,
            type: 'EXPENSE',
            status: 'COMPLETED',
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          _sum: {
            amount: true,
          },
        });

        const spentAmount = Number(spent._sum.amount || 0);
        const budgetAmount = Number(budget.amount);
        const percentage = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0;

        let status: 'ok' | 'warning' | 'exceeded' = 'ok';
        if (percentage >= 100) status = 'exceeded';
        else if (percentage >= 80) status = 'warning';

        return {
          id: budget.id,
          categoryName: budget.category.name,
          amount: budgetAmount,
          spent: spentAmount,
          percentage: Math.round(percentage * 10) / 10,
          status,
          categoryColor: budget.category.color,
          categoryIcon: budget.category.icon || undefined,
        };
      }),
    );

    const overBudget = budgetsWithSpent.filter((b) => b.status === 'exceeded');
    const nearLimit = budgetsWithSpent.filter((b) => b.status === 'warning');

    return {
      items: budgetsWithSpent,
      overBudget,
      nearLimit,
      totalBudgets: budgetsWithSpent.length,
    };
  }

  // ==================== RECURRING TRANSACTIONS ====================
  private async getUpcomingRecurring(
    userId: string,
  ): Promise<UpcomingRecurringDto[]> {
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const recurring = await this.prisma.recurringTransaction.findMany({
      where: {
        userId,
        isActive: true,
        nextOccurrence: {
          gte: now,
          lte: next7Days,
        },
      },
      include: {
        account: true,
      },
      orderBy: {
        nextOccurrence: 'asc',
      },
    });

    return recurring.map((r) => {
      const daysUntil = Math.ceil(
        (new Date(r.nextOccurrence).getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      return {
        id: r.id,
        description: r.description,
        type: r.type,
        amount: Number(r.amount),
        nextOccurrence: r.nextOccurrence,
        daysUntil,
        frequency: r.frequency,
        accountName: r.account.name,
      };
    });
  }

  // ==================== NOTIFICATIONS ====================
  private async getNotificationsSummary(
    userId: string,
  ): Promise<NotificationsSummaryDto> {
    const unreadCount = await this.prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });

    const recent = await this.prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    return {
      unreadCount,
      recent: recent.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt,
      })),
    };
  }

  // ==================== IMPORTANT DATES ====================
  private generateImportantDates(
    recurring: UpcomingRecurringDto[],
    goals: any[],
    budgets: any[],
  ): ImportantDateDto[] {
    const dates: ImportantDateDto[] = [];
    const now = new Date();
    const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Adicionar transações recorrentes
    recurring.forEach((r) => {
      if (new Date(r.nextOccurrence) <= next30Days) {
        dates.push({
          type: 'recurring',
          title: r.description,
          date: r.nextOccurrence,
          daysUntil: r.daysUntil,
          referenceId: r.id,
        });
      }
    });

    // Adicionar metas com deadline próximo
    goals.forEach((g) => {
      if (g.targetDate && new Date(g.targetDate) <= next30Days) {
        dates.push({
          type: 'goal',
          title: `Meta: ${g.name}`,
          date: g.targetDate,
          daysUntil: g.daysRemaining || 0,
          referenceId: g.id,
        });
      }
    });

    // Ordenar por data
    return dates.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }

  // ==================== INSIGHTS ====================
  private generateInsights(
    accounts: AccountsSummaryDto,
    currentMonth: CurrentMonthSummaryDto,
    goals: GoalsSummaryDto,
    budgets: BudgetsSummaryDto,
  ): InsightDto[] {
    const insights: InsightDto[] = [];

    // Insight 1: Saldo total
    if (accounts.totalBalance < 0) {
      insights.push({
        type: 'error',
        title: 'Saldo Negativo',
        message: `Seu saldo total está negativo em R$ ${Math.abs(accounts.totalBalance).toFixed(2)}`,
        icon: '⚠️',
      });
    } else if (accounts.totalBalance > 0) {
      insights.push({
        type: 'success',
        title: 'Saldo Positivo',
        message: `Você possui R$ ${accounts.totalBalance.toFixed(2)} no total`,
        icon: '💰',
      });
    }

    // Insight 2: Resultado do mês
    if (currentMonth.balance > 0) {
      insights.push({
        type: 'success',
        title: 'Mês Positivo',
        message: `Você economizou R$ ${currentMonth.balance.toFixed(2)} este mês!`,
        icon: '📈',
      });
    } else if (currentMonth.balance < 0) {
      insights.push({
        type: 'warning',
        title: 'Atenção aos Gastos',
        message: `Suas despesas superaram as receitas em R$ ${Math.abs(currentMonth.balance).toFixed(2)} este mês`,
        icon: '📉',
      });
    }

    // Insight 3: Comparação com mês anterior
    if (currentMonth.comparisonWithLastMonth.expenseChange > 15) {
      insights.push({
        type: 'warning',
        title: 'Gastos em Alta',
        message: `Seus gastos aumentaram ${currentMonth.comparisonWithLastMonth.expenseChange.toFixed(1)}% em relação ao mês anterior`,
        icon: '⬆️',
      });
    } else if (currentMonth.comparisonWithLastMonth.expenseChange < -15) {
      insights.push({
        type: 'success',
        title: 'Economia em Alta',
        message: `Você reduziu seus gastos em ${Math.abs(currentMonth.comparisonWithLastMonth.expenseChange).toFixed(1)}% comparado ao mês anterior!`,
        icon: '⬇️',
      });
    }

    // Insight 4: Orçamentos estourados
    if (budgets.overBudget.length > 0) {
      insights.push({
        type: 'error',
        title: 'Orçamentos Estourados',
        message: `Você estourou ${budgets.overBudget.length} orçamento(s) este mês`,
        icon: '🚨',
      });
    }

    // Insight 5: Orçamentos perto do limite
    if (budgets.nearLimit.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Orçamentos Próximos do Limite',
        message: `${budgets.nearLimit.length} orçamento(s) estão em mais de 80% do limite`,
        icon: '⚡',
      });
    }

    // Insight 6: Metas próximas de completar
    if (goals.nearCompletion.length > 0) {
      insights.push({
        type: 'success',
        title: 'Metas Quase Alcançadas',
        message: `Você está perto de completar ${goals.nearCompletion.length} meta(s)!`,
        icon: '🎯',
      });
    }

    // Insight 7: Média diária de gastos
    if (currentMonth.avgDailyExpense > 0) {
      insights.push({
        type: 'info',
        title: 'Média Diária',
        message: `Você gasta em média R$ ${currentMonth.avgDailyExpense.toFixed(2)} por dia`,
        icon: '📊',
      });
    }

    return insights;
  }
}
