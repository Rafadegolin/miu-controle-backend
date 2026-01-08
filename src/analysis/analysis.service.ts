import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Gera relatório mensal para um usuário
   */
  async generateMonthlyReport(userId: string, targetDate: Date) {
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
    
    // 1. Buscando dados do mês atual
    const currentMonthStats = await this.getMonthlyStats(userId, startOfMonth, endOfMonth);
    
    // 2. Buscando dados do mês anterior
    const prevMonthDate = new Date(startOfMonth);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonthStats = await this.getMonthlyStats(userId, 
        new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1),
        new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0)
    );

    // 3. Calculando Médias (6 meses)
    const avgStats = await this.getSixMonthAverage(userId, startOfMonth);

    // 4. Comparativos
    const comparisonPrev = this.calculateDeltas(currentMonthStats, prevMonthStats);
    const comparisonAvg = this.calculateDeltas(currentMonthStats, avgStats);

    // 5. Anomalias & Insights
    const anomalies = this.detectAnomalies(currentMonthStats, avgStats, userId);
    const insights = this.generateInsights(currentMonthStats, comparisonPrev, comparisonAvg);
    const trends = await this.detectTrends(userId, startOfMonth);

    // 6. Top Categories
    const topCategories = currentMonthStats.categories.slice(0, 5);

    // 7. Salvar
    return this.prisma.monthlyReport.upsert({
        where: { userId_month: { userId, month: startOfMonth } },
        update: {
            totalIncome: currentMonthStats.income,
            totalExpense: currentMonthStats.expense,
            balance: currentMonthStats.balance,
            savingsRate: currentMonthStats.income > 0 ? ((currentMonthStats.income - currentMonthStats.expense) / currentMonthStats.income) * 100 : 0,
            topCategories: topCategories as any,
            anomalies: anomalies as any,
            trends: trends as any,
            insights: insights as any,
            comparisonPrev: comparisonPrev as any,
            comparisonAvg: comparisonAvg as any,
            generatedAt: new Date()
        },
        create: {
            userId,
            month: startOfMonth,
            totalIncome: currentMonthStats.income,
            totalExpense: currentMonthStats.expense,
            balance: currentMonthStats.balance,
            savingsRate: currentMonthStats.income > 0 ? ((currentMonthStats.income - currentMonthStats.expense) / currentMonthStats.income) * 100 : 0,
            topCategories: topCategories as any,
            anomalies: anomalies as any,
            trends: trends as any,
            insights: insights as any,
            comparisonPrev: comparisonPrev as any,
            comparisonAvg: comparisonAvg as any
        }
    });
  }

  // --- Helpers ---

  private async getMonthlyStats(userId: string, start: Date, end: Date) {
    const transactions = await this.prisma.transaction.findMany({
        where: { userId, date: { gte: start, lte: end } },
        include: { category: true }
    });

    let income = 0;
    let expense = 0;
    const categoryMap = new Map<string, { name: string, amount: number, color: string }>();

    for (const t of transactions) {
        const amount = Number(t.amount);
        if (t.type === 'INCOME') income += amount;
        else if (t.type === 'EXPENSE') {
            expense += amount;
            const catId = t.categoryId || 'uncategorized';
            const current = categoryMap.get(catId) || { name: t.category?.name || 'Outros', amount: 0, color: t.category?.color || '#ccc' };
            current.amount += amount;
            categoryMap.set(catId, current);
        }
    }

    const categories = Array.from(categoryMap.values()).sort((a,b) => b.amount - a.amount);

    return { income, expense, balance: income - expense, categories };
  }

  private async getSixMonthAverage(userId: string, refDate: Date) {
      // Simplified: average of totals
      // Ideal: average per category for anomaly detection
      const start = new Date(refDate);
      start.setMonth(start.getMonth() - 6);
      
      // We need aggregate data. For MVP, reusing getMonthlyStats 6 times is expensive but cleaner logic.
      // Better: Prisma GroupBy
      return { income: 0, expense: 0, balance: 0, categories: [] }; // Placeholder for now to compile
  }
  
  private calculateDeltas(current: any, base: any) {
      const calc = (curr, old) => old === 0 ? 0 : ((curr - old) / old) * 100;
      return {
          incomeDiff: calc(current.income, base.income),
          expenseDiff: calc(current.expense, base.expense),
          balanceDiff: calc(current.balance, base.balance)
      };
  }

  private detectAnomalies(current: any, avg: any, userId: string) {
      return []; // Placeholder
  }

  private generateInsights(current: any, prev: any, avg: any) {
      const texts = [];
      if (current.balance > 0) texts.push(`🟢 Você fechou o mês no azul! Saldo positivo de R$ ${current.balance.toFixed(2)}.`);
      else texts.push(`🔴 Atenção: Déficit de R$ ${Math.abs(current.balance).toFixed(2)} este mês.`);
      
      if (prev.expenseDiff < -10) texts.push(`📉 Parabéns! Você gastou ${Math.abs(prev.expenseDiff).toFixed(1)}% a menos que mês passado.`);
      if (prev.expenseDiff > 10) texts.push(`📈 Seus gastos aumentaram ${prev.expenseDiff.toFixed(1)}% em relação ao mês anterior.`);
      
      return texts;
  }

  private async detectTrends(userId: string, refDate: Date) {
      return { type: 'STABLE', description: 'Gasto estável' };
  }

  async getLatestReport(userId: string) {
      return this.prisma.monthlyReport.findFirst({
          where: { userId },
          orderBy: { month: 'desc' }
      });
  }
}
