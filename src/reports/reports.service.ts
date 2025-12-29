import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { Prisma } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private cacheService: CacheService,
  ) {}

  /**
   * Dashboard resumido com KPIs principais
   * Cache: 5 minutos
   */
  async getDashboard(userId: string, filters: ReportFiltersDto) {
    const cacheKey = `reports:${userId}:dashboard:${JSON.stringify(filters)}`;

    // Tentar buscar do cache
    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        this.cacheService.logHit(cacheKey);
        return cached as any;
      }
    } catch (error) {
      // Se cache falhar, continua para o banco
    }

    this.cacheService.logMiss(cacheKey);
    const where = this.buildWhereClause(userId, filters);

    // Buscar todas as transações do período
    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        category: true,
        account: true,
      },
    });

    // Calcular totais
    const totalIncome = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpense = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const balance = totalIncome - totalExpense;

    // Contar transações
    const transactionCount = transactions.length;
    const incomeCount = transactions.filter((t) => t.type === 'INCOME').length;
    const expenseCount = transactions.filter(
      (t) => t.type === 'EXPENSE',
    ).length;

    // Média diária
    const startDate = filters.startDate
      ? new Date(filters.startDate)
      : new Date(new Date().getFullYear(), 0, 1);
    const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
    const days =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) || 1;

    const avgDailyIncome = totalIncome / days;
    const avgDailyExpense = totalExpense / days;

    // Maior receita e despesa
    const highestIncome = transactions
      .filter((t) => t.type === 'INCOME')
      .sort((a, b) => Number(b.amount) - Number(a.amount))[0];

    const highestExpense = transactions
      .filter((t) => t.type === 'EXPENSE')
      .sort((a, b) => Number(b.amount) - Number(a.amount))[0];

    const result = {
      summary: {
        totalIncome,
        totalExpense,
        balance,
        transactionCount,
        incomeCount,
        expenseCount,
      },
      averages: {
        avgDailyIncome: Math.round(avgDailyIncome * 100) / 100,
        avgDailyExpense: Math.round(avgDailyExpense * 100) / 100,
        avgTransactionValue:
          Math.round(((totalIncome + totalExpense) / transactionCount) * 100) /
          100,
      },
      highlights: {
        highestIncome: highestIncome
          ? {
              amount: Number(highestIncome.amount),
              description: highestIncome.description,
              date: highestIncome.date,
            }
          : null,
        highestExpense: highestExpense
          ? {
              amount: Number(highestExpense.amount),
              description: highestExpense.description,
              date: highestExpense.date,
            }
          : null,
      },
      period: {
        startDate,
        endDate,
        days,
      },
    };

    // Salvar no cache por 5 minutos (300000ms)
    try {
      await this.cacheManager.set(cacheKey, result, 300000);
    } catch (error) {
      // Se falhar ao salvar cache, apenas continue
    }

    return result;
  }

  /**
   * Análise por categorias
   */
  async getCategoryAnalysis(userId: string, filters: ReportFiltersDto) {
    const where = this.buildWhereClause(userId, filters);

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        category: true,
      },
    });

    // Agrupar por categoria
    const categoryMap = new Map<string, any>();

    transactions.forEach((t) => {
      const categoryId = t.categoryId || 'sem-categoria';
      const categoryName = t.category?.name || 'Sem categoria';
      const categoryColor = t.category?.color || '#64748B';
      const categoryIcon = t.category?.icon || '📌';

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          categoryId,
          categoryName,
          categoryColor,
          categoryIcon,
          totalIncome: 0,
          totalExpense: 0,
          count: 0,
          transactions: [],
        });
      }

      const entry = categoryMap.get(categoryId);
      entry.count++;

      if (t.type === 'INCOME') {
        entry.totalIncome += Number(t.amount);
      } else {
        entry.totalExpense += Number(t.amount);
      }

      entry.transactions.push({
        id: t.id,
        amount: Number(t.amount),
        description: t.description,
        date: t.date,
        type: t.type,
      });
    });

    // Converter para array e ordenar
    const categories = Array.from(categoryMap.values())
      .map((cat) => ({
        ...cat,
        total: cat.totalIncome + cat.totalExpense,
        percentage: 0, // Será calculado depois
      }))
      .sort((a, b) => b.total - a.total);

    // Calcular porcentagens
    const grandTotal = categories.reduce((sum, cat) => sum + cat.total, 0);
    categories.forEach((cat) => {
      cat.percentage =
        grandTotal > 0
          ? Math.round((cat.total / grandTotal) * 100 * 100) / 100
          : 0;
    });

    return {
      categories,
      totalCategories: categories.length,
      grandTotal,
    };
  }

  /**
   * Análise mensal (gráfico de linha)
   */
  async getMonthlyTrend(userId: string, filters: ReportFiltersDto) {
    const where = this.buildWhereClause(userId, filters);

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: {
        date: 'asc',
      },
    });

    // Agrupar por mês
    const monthMap = new Map<string, any>();

    transactions.forEach((t) => {
      const date = new Date(t.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthKey,
          income: 0,
          expense: 0,
          balance: 0,
          transactionCount: 0,
        });
      }

      const entry = monthMap.get(monthKey);
      entry.transactionCount++;

      if (t.type === 'INCOME') {
        entry.income += Number(t.amount);
      } else {
        entry.expense += Number(t.amount);
      }

      entry.balance = entry.income - entry.expense;
    });

    const months = Array.from(monthMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month),
    );

    return {
      months,
      totalMonths: months.length,
    };
  }

  /**
   * Análise por conta
   */
  async getAccountAnalysis(userId: string, filters: ReportFiltersDto) {
    const where = this.buildWhereClause(userId, filters);

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        account: true,
      },
    });

    // Agrupar por conta
    const accountMap = new Map<string, any>();

    transactions.forEach((t) => {
      const accountId = t.accountId;
      const accountName = t.account.name;
      const accountColor = t.account.color;

      if (!accountMap.has(accountId)) {
        accountMap.set(accountId, {
          accountId,
          accountName,
          accountColor,
          currentBalance: Number(t.account.currentBalance),
          totalIncome: 0,
          totalExpense: 0,
          count: 0,
        });
      }

      const entry = accountMap.get(accountId);
      entry.count++;

      if (t.type === 'INCOME') {
        entry.totalIncome += Number(t.amount);
      } else {
        entry.totalExpense += Number(t.amount);
      }
    });

    const accounts = Array.from(accountMap.values())
      .map((acc) => ({
        ...acc,
        netFlow: acc.totalIncome - acc.totalExpense,
      }))
      .sort((a, b) => b.currentBalance - a.currentBalance);

    return {
      accounts,
      totalAccounts: accounts.length,
    };
  }

  /**
   * Top despesas e receitas
   */
  async getTopTransactions(
    userId: string,
    filters: ReportFiltersDto,
    limit: number = 10,
  ) {
    const where = this.buildWhereClause(userId, filters);

    const topExpenses = await this.prisma.transaction.findMany({
      where: {
        ...where,
        type: 'EXPENSE',
      },
      include: {
        category: true,
        account: true,
      },
      orderBy: {
        amount: 'desc',
      },
      take: limit,
    });

    const topIncomes = await this.prisma.transaction.findMany({
      where: {
        ...where,
        type: 'INCOME',
      },
      include: {
        category: true,
        account: true,
      },
      orderBy: {
        amount: 'desc',
      },
      take: limit,
    });

    return {
      topExpenses: topExpenses.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        description: t.description,
        date: t.date,
        category: t.category?.name || 'Sem categoria',
        account: t.account.name,
      })),
      topIncomes: topIncomes.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        description: t.description,
        date: t.date,
        category: t.category?.name || 'Sem categoria',
        account: t.account.name,
      })),
    };
  }

  /**
   * Análise de tendências e insights
   */
  async getInsights(userId: string, filters: ReportFiltersDto) {
    const dashboard = await this.getDashboard(userId, filters);
    const categoryAnalysis = await this.getCategoryAnalysis(userId, filters);
    const monthlyTrend = await this.getMonthlyTrend(userId, filters);

    const insights = [];

    // Insight 1: Resultado do período
    if (dashboard.summary.balance > 0) {
      insights.push({
        type: 'positive',
        title: 'Saldo Positivo',
        message: `Você economizou R$ ${dashboard.summary.balance.toFixed(2)} neste período!`,
        icon: '💰',
      });
    } else if (dashboard.summary.balance < 0) {
      insights.push({
        type: 'negative',
        title: 'Atenção: Saldo Negativo',
        message: `Suas despesas superaram as receitas em R$ ${Math.abs(dashboard.summary.balance).toFixed(2)}`,
        icon: '⚠️',
      });
    }

    // Insight 2: Categoria com maior gasto
    if (categoryAnalysis.categories.length > 0) {
      const topCategory = categoryAnalysis.categories[0];
      insights.push({
        type: 'info',
        title: 'Maior Categoria de Gastos',
        message: `${topCategory.categoryName} representa ${topCategory.percentage}% dos seus gastos (R$ ${topCategory.totalExpense.toFixed(2)})`,
        icon: topCategory.categoryIcon,
      });
    }

    // Insight 3: Média diária
    insights.push({
      type: 'info',
      title: 'Média Diária',
      message: `Você gasta em média R$ ${dashboard.averages.avgDailyExpense.toFixed(2)} por dia`,
      icon: '📊',
    });

    // Insight 4: Tendência mensal
    if (monthlyTrend.months.length >= 2) {
      const lastMonth = monthlyTrend.months[monthlyTrend.months.length - 1];
      const previousMonth = monthlyTrend.months[monthlyTrend.months.length - 2];
      const expenseChange =
        ((lastMonth.expense - previousMonth.expense) / previousMonth.expense) *
        100;

      if (expenseChange > 10) {
        insights.push({
          type: 'warning',
          title: 'Gastos em Alta',
          message: `Seus gastos aumentaram ${expenseChange.toFixed(1)}% em relação ao mês anterior`,
          icon: '📈',
        });
      } else if (expenseChange < -10) {
        insights.push({
          type: 'positive',
          title: 'Gastos em Queda',
          message: `Você reduziu seus gastos em ${Math.abs(expenseChange).toFixed(1)}% em relação ao mês anterior!`,
          icon: '📉',
        });
      }
    }

    return insights;
  }

  /**
   * Relatório completo (todos os dados)
   */
  async getFullReport(userId: string, filters: ReportFiltersDto) {
    const [
      dashboard,
      categoryAnalysis,
      monthlyTrend,
      accountAnalysis,
      topTransactions,
      insights,
    ] = await Promise.all([
      this.getDashboard(userId, filters),
      this.getCategoryAnalysis(userId, filters),
      this.getMonthlyTrend(userId, filters),
      this.getAccountAnalysis(userId, filters),
      this.getTopTransactions(userId, filters),
      this.getInsights(userId, filters),
    ]);

    return {
      dashboard,
      categoryAnalysis,
      monthlyTrend,
      accountAnalysis,
      topTransactions,
      insights,
      generatedAt: new Date(),
    };
  }

  // ==================== MÉTODOS AUXILIARES ====================

  private buildWhereClause(
    userId: string,
    filters: ReportFiltersDto,
  ): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = {
      userId,
      status: 'COMPLETED',
    };

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    if (filters.type) where.type = filters.type;
    if (filters.accountId) where.accountId = filters.accountId;
    if (filters.categoryId) where.categoryId = filters.categoryId;

    return where;
  }
}
