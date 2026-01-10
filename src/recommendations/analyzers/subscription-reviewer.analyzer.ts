import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Analyzer, AnalyzerResult } from './analyzer.interface';
import { RecommendationType } from '@prisma/client';

@Injectable()
export class SubscriptionReviewerAnalyzer implements Analyzer {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(userId: string): Promise<AnalyzerResult[]> {
    const results: AnalyzerResult[] = [];

    // Busca transações recorrentes ativas
    const recurring = await this.prisma.recurringTransaction.findMany({
      where: { userId, isActive: true, type: 'EXPENSE' },
    });

    // TODO: Compara com uso real (difícil sem dados de acesso a serviços), 
    // mas pode sugerir revisão de assinaturas caras (> R$ 50) ou antigas.
    
    for (const sub of recurring) {
        const amount = Number(sub.amount);
        // Exemplo simples: Se for > 100 reais, sugere revisão
        if (amount > 100) {
            results.push({
                type: RecommendationType.SUBSCRIPTION_REVIEW,
                title: `Revisar assinatura: ${sub.description}`,
                description: `Sua assinatura de ${sub.description} custa R$ ${amount.toFixed(2)}. Você ainda utiliza este serviço com frequência que justifique o valor?`,
                impact: amount, // Impacto é o valor total mensal
                difficulty: 2, // Geralmente fácil cancelar
                category: 'Assinaturas',
                metadata: { recurringTransactionId: sub.id }
            });
        }
    }

    return results;
  }
}
