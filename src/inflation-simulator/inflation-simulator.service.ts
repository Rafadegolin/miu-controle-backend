import { Injectable, Logger } from '@nestjs/common';
import { GoalsService } from '../goals/goals.service';
import { BudgetsService } from '../budgets/budgets.service';
import { InflationSimulationDto } from './dto/inflation-simulation.dto';
import { InflationImpactDto, PurchasingPowerProjection, GoalInflationImpact, BudgetInflationImpact } from './dto/inflation-impact.dto';

@Injectable()
export class InflationSimulatorService {
  private readonly logger = new Logger(InflationSimulatorService.name);

  constructor(
    private goalsService: GoalsService,
    private budgetsService: BudgetsService
  ) {}

  async simulate(userId: string, dto: InflationSimulationDto): Promise<InflationImpactDto> {
      const { inflationRate, salaryAdjustment, periodMonths = 12 } = dto;
      
      // 1. Calculate Real Gain
      // Formula: ((1 + salary) / (1 + inflation)) - 1
      const realGainRate = ((1 + salaryAdjustment/100) / (1 + inflationRate/100) - 1) * 100;
      
      // 2. Project Purchasing Power (for a reference value of 1000)
      // Monthly inflation rate
      const monthlyInflation = Math.pow(1 + inflationRate/100, 1/12) - 1;
      const projections: PurchasingPowerProjection[] = [];
      let currentRealValue = 1000;
      
      for(let i=0; i<=periodMonths; i++) {
          projections.push({
              month: i,
              nominalValue: 1000,
              realValue: Number(currentRealValue.toFixed(2))
          });
          currentRealValue = currentRealValue / (1 + monthlyInflation);
      }
      
      const purchasingPowerLost = 1000 - projections[projections.length-1].realValue;

      // 3. Impact on Goals
      const goals = await this.goalsService.findAll(userId, 'ACTIVE');
      const affectedGoals: GoalInflationImpact[] = [];
      
      for(const goal of goals) {
          if (!goal.targetDate) continue;
          
          const today = new Date();
          const target = new Date(goal.targetDate as unknown as string); // Cast safely
          const diffTime = target.getTime() - today.getTime();
          const years = diffTime / (1000 * 60 * 60 * 24 * 365.25);
          
          if (years <= 0) continue;

          // Projected Cost = CurrentCost * (1 + inflation)^years
          const original = Number(goal.targetAmount);
          const adjusted = original * Math.pow(1 + inflationRate/100, years);
          
          affectedGoals.push({
              goalId: goal.id,
              name: goal.name,
              originalTarget: original,
              adjustedTarget: Number(adjusted.toFixed(2)),
              difference: Number((adjusted - original).toFixed(2)),
              yearsToTarget: Number(years.toFixed(1))
          });
      }

      // 4. Impact on Budgets
      // Find Monthly Budgets
      // Assuming budgetsService.findAll returns user budgets. Note: findAll takes period arg.
      // We need to define how to access budgets. The interface findAll(userId, period?) exists.
      const budgets = await this.budgetsService.findAll(userId, 'MONTHLY');
      const budgetImpacts: BudgetInflationImpact[] = [];
      
      for(const budget of budgets) {
          const original = Number(budget.amount);
          // Simple projection: To buy same stuff in 1 year, you need +inflation%
          // Monthly increase needed roughly = (Original * InflationRate) / 12 (Spread over year? No, that's not right)
          // It means next year, the budget might need to be Original * (1+inflation).
          // Let's assume the question is "What should my budget be in 'periodMonths'?"
          
          // Let's calculate the value needed at the END of the period to maintain same power.
          // Or simpler: average monthly increase required.
          const projected = original * Math.pow(1 + monthlyInflation, periodMonths);
          
          budgetImpacts.push({
              budgetId: budget.id,
              categoryName: budget.category.name,
              currentAmount: original,
              projectedAmount: Number(projected.toFixed(2)),
              monthlyIncrease: Number((projected - original).toFixed(2))
          });
      }

      // 5. Recommendations
      const recommendations = [];
      if (realGainRate < 0) {
          recommendations.push('🔴 Seu poder de compra está diminuindo. Considere cortar gastos ou buscar aumento de renda.');
      } else if (realGainRate < 1) {
          recommendations.push('🟠 Seu ganho real é baixo. Mantenha os orçamentos sob controle rígido.');
      } else {
          recommendations.push('🟢 Você está ganhando da inflação! Considere investir o excedente.');
      }

      if (affectedGoals.some(g => g.difference > 1000)) {
           recommendations.push('⚠️ Algumas metas de longo prazo podem custar bem mais caro. Considere revisar os valores alvo.');
      }

      return {
          realGainRate: Number(realGainRate.toFixed(2)),
          purchasingPowerLost: Number(purchasingPowerLost.toFixed(2)),
          purchasingPowerProjections: projections,
          affectedGoals,
          budgetImpacts,
          recommendations
      };
  }

  getScenarios() {
      return [
          {
              title: 'Cenário Otimista',
              inflationRate: 3.0,
              salaryAdjustment: 6.0,
              description: 'Inflação controlada e ganho real de 3%.'
          },
          {
              title: 'Cenário Atual (Realista)',
              inflationRate: 4.62, // Example IPCA
              salaryAdjustment: 4.62, // Reposição apenas
              description: 'Manutenção do poder de compra.'
          },
          {
              title: 'Cenário Pessimista',
              inflationRate: 8.0,
              salaryAdjustment: 2.0,
              description: 'Alta inflação com perda salarial significativa.'
          }
      ];
  }
}
