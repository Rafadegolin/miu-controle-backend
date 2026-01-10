import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Analyzer, AnalyzerResult } from './analyzer.interface';
import { RecommendationType } from '@prisma/client';

@Injectable()
export class BudgetOptimizerAnalyzer implements Analyzer {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(userId: string): Promise<AnalyzerResult[]> {
    const results: AnalyzerResult[] = [];

    // Busca orçamentos ativos do mês atual
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Simplificação: assume orçamento 'MONTHLY' com startDate neste mês ou genéricos
    // Na prática, buscaria orçamentos válidos para o período atual
    const budgets = await this.prisma.budget.findMany({
      where: { 
        userId,
        period: 'MONTHLY',
        startDate: { lte: now },
        OR: [
          { endDate: null },
          { endDate: { gte: now } }
        ]
      },
      include: { category: true }
    });

    for (const budget of budgets) {
      // Calcular gastos na categoria neste mês
      const expenses = await this.prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: budget.categoryId,
          type: 'EXPENSE',
          date: { gte: startOfMonth, lte: now },
        },
        _sum: { amount: true },
      });

      const spent = Number(expenses._sum.amount || 0);
      const budgetAmount = Number(budget.amount);
      const usage = (spent / budgetAmount) * 100;

      // Caso 1: Orçamento estourado consistentemente (aqui simplificado apenas para status atual)
      if (usage > 100) {
        results.push({
          type: RecommendationType.OPTIMIZE_BUDGET,
          title: `Orçamento estourado em ${budget.category.name}`,
          description: `Você já gastou ${usage.toFixed(0)}% do seu orçamento de ${budget.category.name}. Considere aumentar o limite ou cortar gastos imediatamente.`,
          impact: 0, // Impacto financeiro direto é zero, mas organizacional é alto
          difficulty: 2,
          category: budget.category.name,
          metadata: { budgetId: budget.id, action: 'INCREASE' }
        });
      }

      // Caso 2: Orçamento subutilizado (< 50% perto do fim do mês)
      // Checar se estamos depois do dia 25
      if (now.getDate() > 25 && usage < 50) {
        const potentialSavings = budgetAmount - spent;
        results.push({
          type: RecommendationType.OPTIMIZE_BUDGET,
          title: `Orçamento sobrando em ${budget.category.name}`,
          description: `Você usou apenas ${usage.toFixed(0)}% do orçamento de ${budget.category.name}. Você pode reduzir esse orçamento e destinar ${potentialSavings.toFixed(2)} para investimentos.`,
          impact: potentialSavings,
          difficulty: 1,
          category: budget.category.name,
          metadata: { budgetId: budget.id, action: 'DECREASE', suggestedAmount: spent * 1.2 }
        });
      }
    }

    return results;
  }
}
