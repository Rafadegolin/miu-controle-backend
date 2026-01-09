import { Injectable, Logger } from '@nestjs/common';
import { AnalysisService } from '../analysis/analysis.service';
import { GoalsService } from '../goals/goals.service';
import { PrismaService } from '../prisma/prisma.service'; // Import Prisma
import { SimulateScenarioDto, ScenarioType } from './dto/simulate-scenario.dto';
import { ScenarioResultDto } from './dto/scenario-result.dto';

@Injectable()
export class ScenariosService {
  private readonly logger = new Logger(ScenariosService.name);

  constructor(
    private analysisService: AnalysisService,
    private goalsService: GoalsService,
    private prisma: PrismaService // Inject Prisma
  ) {}

  async simulate(userId: string, dto: SimulateScenarioDto): Promise<ScenarioResultDto> {
    this.logger.log(`Simulating scenario ${dto.type} for user ${userId}`);
    
    // 1. Get Baseline (Average 3 months)
    const baseline = await this.getBaseline(userId);
    
    // Get Current Total Balance
    const accounts = await this.prisma.account.findMany({ where: { userId } });
    const currentBalance = accounts.reduce((sum, acc) => sum + Number(acc.currentBalance), 0);

    // 2. Project 12 Months (Baseline)
    const baseProjection = this.projectCashFlow(currentBalance, baseline.surplus, 12);

    // 3. Apply Scenario
    const scenarioProjection = this.applyScenario(baseProjection, dto);

    // 4. Detect Impact (Goals & negative balance)
    const lowestBalance = Math.min(...scenarioProjection);
    const isViable = lowestBalance >= 0;
    
    // 5. Generate Recommendations
    const recommendations = [];
    if (!isViable) {
        if (dto.installments && dto.installments > 1) {
             recommendations.push({
                type: 'INSTALLMENT',
                message: 'Aumente o número de parcelas para reduzir o impacto mensal.'
             });
        } else if (dto.type === ScenarioType.BIG_PURCHASE) {
             recommendations.push({
                type: 'INSTALLMENT', 
                message: 'Considere parcelar esta compra.'
             });
        }
        
        recommendations.push({
            type: 'DELAY', 
            message: 'Saldo ficará negativo. Considere adiar esta decisão.'
        });

        // Suggest Cuts if needed
        if (Math.abs(lowestBalance) < 1000) {
            recommendations.push({
                type: 'CUT',
                message: 'Pequenos cortes em categorias não essenciais podem viabilizar.'
            });
        }
    }

    return {
        isViable,
        currentBalance,
        projectedBalance12Months: scenarioProjection,
        lowestBalance,
        impactedGoals: [], // Simplified for MVP
        recommendations,
        alternativeScenarios: []
    };
  }

  private async getBaseline(userId: string) {
       // Copy logic from PlanningService or similar
       const end = new Date();
       const start = new Date();
       start.setMonth(start.getMonth() - 3);

       const transactions = await this.prisma.transaction.findMany({
           where: { 
               userId, 
               date: { gte: start, lte: end },
               type: { in: ['INCOME', 'EXPENSE'] },
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

  private projectCashFlow(startBalance: number, monthlySurplus: number, months: number): number[] {
      const projection = [];
      let current = startBalance;
      for (let i = 0; i < months; i++) {
          current += monthlySurplus;
          projection.push(current);
      }
      return projection;
  }

  private applyScenario(projection: number[], dto: SimulateScenarioDto): number[] {
      const newProjection = [...projection];
      
      if (dto.type === ScenarioType.BIG_PURCHASE || dto.type === ScenarioType.EMERGENCY_EXPENSE || dto.type === ScenarioType.DEBT_PAYMENT) {
          if (dto.installments && dto.installments > 1) {
              const installmentValue = dto.amount / dto.installments;
              for(let i=0; i<projection.length; i++) {
                  if (i < dto.installments) {
                      // Subtract installment value from this month onwards
                      // Wait, projection is cumulative balance.
                      // So if I pay 100 in month 0, month 0 balance decreases by 100, month 1 by 100, etc.
                      // If I pay 100 in month 0 AND 100 in month 1:
                      // Month 0 balance -= 100
                      // Month 1 balance -= 100 (from month 0) - 100 (new payment) = -200
                      // So for cumulative projection:
                      const monthsToPay = Math.min(dto.installments, projection.length);
                      // This logic is tricky for cumulative.
                      // Correct approach: Calculate monthly CASH FLOW change, then re-accumulate?
                      // Or just adjust cumulative:
                      // Month i impact = (total paid so far)
                      
                      // Let's do:
                      let paidSoFar = 0;
                      if (i < dto.installments) paidSoFar = installmentValue * (i + 1);
                      else paidSoFar = dto.amount;

                      newProjection[i] -= paidSoFar;
                  } else {
                       newProjection[i] -= dto.amount;
                  }
              }
          } else {
              // One-time payment at start
              newProjection.forEach((_, idx) => newProjection[idx] -= dto.amount);
          }
      } else if (dto.type === ScenarioType.INCOME_LOSS) {
          // Reduce monthly surplus from start date
          // projection[i] = projection[i-1] + (surplus - loss)
          // Simplified:
          newProjection.forEach((_, idx) => newProjection[idx] -= (dto.amount * (idx + 1)));
      } else if (dto.type === ScenarioType.NEW_RECURRING) {
           newProjection.forEach((_, idx) => newProjection[idx] -= (dto.amount * (idx + 1)));
      }

      return newProjection;
  }

  private async detectGoalImpact(userId: string, projection: number[]) {
      const activeGoals = await this.goalsService.findAll(userId, 'ACTIVE');
      const impactedGoals: string[] = [];
      const lowestBalance = Math.min(...projection);

      // 1. If balance goes negative, all goals relying on reserves are at risk
      if (lowestBalance < 0) {
          impactedGoals.push('Todas as metas (Saldo negativo projetado)');
          return impactedGoals;
      }

      // 2. Check if monthly surplus is enough for goals (Simplified)
      // We need to know the 'new' surplus after scenario.
      // But projection logic is complex. 
      // Let's assume if projection is strictly increasing or stable above 0, it's fine.
      // If projection has a downward trend that leads to < 0 in > 12 months, that's a risk.
      
      return impactedGoals;
  }
}
