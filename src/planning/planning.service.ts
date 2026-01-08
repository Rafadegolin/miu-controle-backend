import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisService } from '../analysis/analysis.service';

export interface ActionStep {
  title: string;
  description: string;
  value?: number;
  type: 'CUT' | 'SAVE' | 'EARN';
}

@Injectable()
export class PlanningService {
  constructor(
    private prisma: PrismaService,
    private analysisService: AnalysisService
  ) {}

  async calculateGoalPlan(userId: string, goalId: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      include: { plan: true }
    });

    if (!goal) throw new NotFoundException('Objetivo não encontrado');
    if (goal.userId !== userId) throw new NotFoundException('Objetivo não encontrado');

    const targetAmount = Number(goal.targetAmount);
    const currentAmount = Number(goal.currentAmount);
    const remaining = targetAmount - currentAmount;
    
    if (remaining <= 0) {
      return { status: 'COMPLETED', message: 'Objetivo já atingido!' };
    }

    // Calcular meses restantes
    const today = new Date();
    const targetDate = goal.targetDate ? new Date(goal.targetDate) : null;
    let monthsRemaining = 12; // Default 1 year if no date
    
    if (targetDate) {
      const diffTime = Math.abs(targetDate.getTime() - today.getTime());
      monthsRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30))); 
    }

    const requiredMonthly = remaining / monthsRemaining;

    // Analisar Finanças do Usuário (Últimos 3 meses)
    // Usar AnalysisService pode ser pesado se chamar reports inteiros, vamos fazer uma query direta ou usar Analysis simplificado
    // Simplificação: Pegar média de Income - Expense dos ultimos 3 meses
    const  stats = await this.getUserAverageSurplus(userId);
    const averageSurplus = stats.surplus;

    const isViable = averageSurplus >= requiredMonthly;
    const margin = averageSurplus - requiredMonthly;

    let plan = {
      monthlyDeposit: requiredMonthly,
      months: monthsRemaining,
      isViable,
      margin,
      recommendations: [] as string[],
      actionPlan: [] as ActionStep[],
      suggestedCuts: [] as any[]
    };

    if (isViable) {
      plan.recommendations.push(`Você tem uma margem de R$ ${margin.toFixed(2)}. Ótimo!`);
      plan.actionPlan.push({
        title: 'Depósito Mensal',
        description: `Configure uma recorrência de R$ ${requiredMonthly.toFixed(2)}`,
        value: requiredMonthly,
        type: 'SAVE'
      });
    } else {
      plan.recommendations.push(`Faltam R$ ${Math.abs(margin).toFixed(2)} mensais.`);
      
      // MOTOR DE OTIMIZAÇÃO: Sugerir Cortes
      const cuts = await this.suggestCuts(userId, Math.abs(margin));
      plan.suggestedCuts = cuts;
      
      const totalPotentialCut = cuts.reduce((acc, c) => acc + c.amount, 0);
      
      if (totalPotentialCut >= Math.abs(margin)) {
         plan.recommendations.push('É possível atingir a meta cortando gastos não essenciais!');
         cuts.forEach(c => {
             plan.actionPlan.push({
                 title: `Cortar em ${c.categoryName}`,
                 description: `Reduzir gastos para R$ ${(c.currentAverage - c.amount).toFixed(2)}`,
                 value: c.amount,
                 type: 'CUT'
             });
         });
      } else {
         // Se cortes não forem suficientes, sugerir aumentar prazo
         plan.recommendations.push('Cortes não são suficientes. Sugerimos estender o prazo.');
         const feasibleMonthly = averageSurplus + totalPotentialCut;
         if (feasibleMonthly > 0) {
             const newMonths = Math.ceil(remaining / feasibleMonthly);
             const extraMonths = newMonths - monthsRemaining;
             plan.actionPlan.push({
                 title: 'Estender Prazo',
                 description: `Adie a meta em ${extraMonths} meses`,
                 type: 'SAVE'
             });
         }
      }
    }

    return plan;
  }

  async savePlan(userId: string, goalId: string, planData: any) {
     return this.prisma.goalPlan.upsert({
         where: { goalId },
         update: {
             monthlyDeposit: planData.monthlyDeposit,
             isViable: planData.isViable,
             actionPlan: planData
         },
         create: {
             goalId,
             monthlyDeposit: planData.monthlyDeposit,
             isViable: planData.isViable,
             actionPlan: planData
         }
     });
  }

  // --- HELPERS ---

  private async getUserAverageSurplus(userId: string) {
      // Pega ultimos 3 meses
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 3);

      const transactions = await this.prisma.transaction.findMany({
          where: { 
              userId, 
              date: { gte: start, lte: end },
              status: 'COMPLETED'
          }
      });

      let income = 0;
      let expense = 0;
      for (const t of transactions) {
          if (t.type === 'INCOME') income += Number(t.amount);
          if (t.type === 'EXPENSE') expense += Number(t.amount);
      }

      return {
          avgIncome: income / 3,
          avgExpense: expense / 3,
          surplus: (income - expense) / 3
      };
  }

  private async suggestCuts(userId: string, targetCutAmount: number) {
      // Analisar gastos em categorias NÃO ESSENCIAIS
      const nonEssentialCategories = await this.prisma.category.findMany({
          where: { userId, isEssential: false }
      });
      
      const catIds = nonEssentialCategories.map(c => c.id);
      
      // Média de gastos nessas categorias (3 meses)
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 3);

      const expenses = await this.prisma.transaction.groupBy({
          by: ['categoryId'],
          where: {
              userId,
              categoryId: { in: catIds },
              type: 'EXPENSE',
              date: { gte: start, lte: end }
          },
          _sum: { amount: true }
      });

      let suggestions = [];
      let remainingToCut = targetCutAmount;

      for (const exp of expenses) {
          if (remainingToCut <= 0) break;
          const avg = Number(exp._sum.amount) / 3;
          if (avg > 0) {
              // Sugerir cortar até 50% de gastos não essenciais
              const potentialCut = avg * 0.5; 
              const cut = Math.min(potentialCut, remainingToCut);
              
              const cat = nonEssentialCategories.find(c => c.id === exp.categoryId);
              
              suggestions.push({
                  categoryId: exp.categoryId,
                  categoryName: cat?.name || 'Outros',
                  currentAverage: avg,
                  amount: cut
              });
              
              remainingToCut -= cut;
          }
      }

      return suggestions;
  }
}
