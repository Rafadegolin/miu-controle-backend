import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Analyzer, AnalyzerResult } from './analyzer.interface';
import { RecommendationType } from '@prisma/client';

@Injectable()
export class RiskAlertAnalyzer implements Analyzer {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(userId: string): Promise<AnalyzerResult[]> {
    const results: AnalyzerResult[] = [];

    // 1. Verificar Reserva de Emergência
    const emergencyFund = await this.prisma.emergencyFund.findUnique({
      where: { userId }
    });

    if (!emergencyFund || Number(emergencyFund.monthsCovered) < 3) {
      const currentMonths = emergencyFund ? Number(emergencyFund.monthsCovered) : 0;
      results.push({
        type: RecommendationType.RISK_ALERT,
        title: 'Reserva de Emergência Baixa',
        description: `Sua reserva cobre apenas ${currentMonths.toFixed(1)} meses de custos. O ideal são pelo menos 6 meses. Recomendamos priorizar aportes na reserva.`,
        impact: 0, // Impacto é segurança, não lucro direto
        difficulty: 4,
        category: 'Segurança Financeira',
        metadata: { action: 'SETUP_EMERGENCY_FUND' }
      });
    }

    // 2. Verificar dependência de receita única (opcional, requer análise de descrições de INCOME)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const incomes = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'INCOME',
        date: { gte: thirtyDaysAgo }
      }
    });

    if (incomes.length > 0) {
        const totalIncome = incomes.reduce((sum, t) => sum + Number(t.amount), 0);
        // Agrupar por pagador (merchant/description)
        const sources: Record<string, number> = {};
        incomes.forEach(t => {
            const source = t.merchant || t.description || 'Outros';
            if (!sources[source]) sources[source] = 0;
            sources[source] += Number(t.amount);
        });

        for (const [source, amount] of Object.entries(sources)) {
            if ((amount / totalIncome) > 0.9) {
                results.push({
                    type: RecommendationType.RISK_ALERT,
                    title: 'Dependência de Fonte Única',
                    description: `90% da sua renda vem de "${source}". Considere diversificar suas fontes de renda para reduzir riscos.`,
                    impact: 0,
                    difficulty: 5,
                    category: 'Carreira',
                });
                break; // Apenas um alerta desse tipo
            }
        }
    }

    return results;
  }
}
