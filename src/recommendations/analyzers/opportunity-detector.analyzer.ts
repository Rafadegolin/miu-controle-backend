import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Analyzer, AnalyzerResult } from './analyzer.interface';
import { RecommendationType } from '@prisma/client';

@Injectable()
export class OpportunityDetectorAnalyzer implements Analyzer {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(userId: string): Promise<AnalyzerResult[]> {
    const results: AnalyzerResult[] = [];

    // 1. Identificar sobra consistente nos últimos 3 meses
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: threeMonthsAgo },
        status: 'COMPLETED'
      }
    });

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
      if (t.type === 'INCOME') totalIncome += Number(t.amount);
      else if (t.type === 'EXPENSE') totalExpense += Number(t.amount);
    });

    const balance = totalIncome - totalExpense;
    const monthlyAverageSurplus = balance / 3;

    if (monthlyAverageSurplus > 200) {
      results.push({
        type: RecommendationType.SAVINGS_OPPORTUNITY,
        title: 'Oportunidade de Investimento',
        description: `Você tem tido uma sobra média de R$ ${monthlyAverageSurplus.toFixed(2)} nos últimos 3 meses. Que tal criar uma meta de investimento com aplicação automática?`,
        impact: monthlyAverageSurplus * 12, // Projeção anual
        difficulty: 2,
        category: 'Investimentos',
        metadata: { suggestedMonthlyAmount: monthlyAverageSurplus * 0.8 } // Sugere investir 80% da sobra
      });
    }

    return results;
  }
}
