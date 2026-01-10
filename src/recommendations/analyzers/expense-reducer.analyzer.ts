import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Analyzer, AnalyzerResult } from './analyzer.interface';
import { RecommendationType } from '@prisma/client';

@Injectable()
export class ExpenseReducerAnalyzer implements Analyzer {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(userId: string): Promise<AnalyzerResult[]> {
    const results: AnalyzerResult[] = [];
    
    // 1. Identificar categorias > 30% do total de gastos nos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const expenses = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: thirtyDaysAgo },
      },
      include: { category: true },
    });

    const totalExpense = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
    if (totalExpense === 0) return [];

    const categoryTotals: Record<string, { amount: number, name: string }> = {};

    expenses.forEach(t => {
      const catId = t.categoryId || 'uncategorized';
      const catName = t.category?.name || 'Sem Categoria';
      if (!categoryTotals[catId]) categoryTotals[catId] = { amount: 0, name: catName };
      categoryTotals[catId].amount += Number(t.amount);
    });

    for (const [catId, data] of Object.entries(categoryTotals)) {
      const percentage = (data.amount / totalExpense) * 100;
      if (percentage > 30) {
        results.push({
          type: RecommendationType.REDUCE_EXPENSE,
          title: `Gasto elevado em ${data.name}`,
          description: `Você gastou R$ ${data.amount.toFixed(2)} em ${data.name}, o que representa ${percentage.toFixed(0)}% do seu total. Tente reduzir 10% deste valor.`,
          impact: data.amount * 0.10, // Sugere economia de 10%
          difficulty: 3,
          category: data.name,
        });
      }
    }

    // 2. Detectar Delivery excessivo (ex: > R$ 300) - Simplificado pela busca de categoria "Delivery" ou similar
    // Melhoria futura: usar categorias do sistema se padronizadas.

    return results;
  }
}
