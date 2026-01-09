import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScenariosService } from '../scenarios/scenarios.service';
import { BudgetsService } from '../budgets/budgets.service';
import { AffordabilityCheckDto, PaymentMethod } from './dto/affordability-check.dto';
import { AffordabilityResultDto, AffordabilityStatus } from './dto/affordability-result.dto';
import { ScenarioType } from '../scenarios/dto/simulate-scenario.dto';

@Injectable()
export class AffordabilityService {
  private readonly logger = new Logger(AffordabilityService.name);

  constructor(
    private prisma: PrismaService,
    private scenariosService: ScenariosService,
    private budgetsService: BudgetsService
  ) {}

  async check(userId: string, dto: AffordabilityCheckDto): Promise<AffordabilityResultDto> {
      // 1. Fetch Context Data
      const accounts = await this.prisma.account.findMany({ where: { userId } });
      const currentBalance = accounts.reduce((sum, acc) => sum + Number(acc.currentBalance), 0);
      
      const budget = await this.prisma.budget.findFirst({
          where: { userId, categoryId: dto.categoryId, period: 'MONTHLY' }, // Assuming monthly for now
          orderBy: { startDate: 'desc' }
      });

      // 2. Calculate Scores
      const balanceScore = this.calculateBalanceScore(currentBalance, dto.amount);
      const budgetScore = await this.calculateBudgetScore(userId, dto, budget);
      const reserveScore = await this.calculateReserveScore(userId, currentBalance, dto.amount);
      const goalScore = await this.calculateGoalImpactScore(userId, dto);
      const historyScore = await this.calculateHistoryScore(userId, dto);
      const timingScore = this.calculateTimingScore(currentBalance);

      const totalScore = balanceScore + budgetScore + reserveScore + goalScore + historyScore + timingScore;
      const finalScore = Math.min(100, Math.max(0, totalScore));

      // 3. Determine Status
      let status = AffordabilityStatus.NOT_RECOMMENDED;
      let color = '#EF4444'; // Red
      
      if (finalScore >= 70) {
          status = AffordabilityStatus.CAN_AFFORD;
          color = '#10B981'; // Green
      } else if (finalScore >= 40) {
          status = AffordabilityStatus.CAUTION;
          color = '#F59E0B'; // Yellow
      }

      // 4. Generate Recommendations
      const recommendations = this.generateRecommendations(status, finalScore, { balanceScore, budgetScore, goalScore });

      return {
          score: Math.round(finalScore),
          status,
          badgeColor: color,
          breakdown: {
              balanceScore,
              budgetScore,
              reserveScore,
              goalScore,
              historyScore,
              timingScore
          },
          recommendations,
          alternatives: [] // TODO
      };
  }

  // --- Scoring Logic ---

  private calculateBalanceScore(balance: number, amount: number): number {
      // Max 25 points
      if (balance >= amount) return 25;
      if (balance >= amount * 0.8) return 15; // Covers 80%
      if (balance >= amount * 0.5) return 5;
      return 0;
  }

  private async calculateBudgetScore(userId: string, dto: AffordabilityCheckDto, budget: any): Promise<number> {
      // Max 20 points
      if (!budget) return 20; // No budget = neutral/good? Or bad? Let's assume neutral (full points) or 10.
      
      // Calculate current spent
      const spent = await this.getCategorySpentCurrentMonth(userId, dto.categoryId);
      const remaining = Number(budget.amount) - spent;
      
      if (remaining >= dto.amount) return 20; // Fits perfectly
      if (remaining >= dto.amount * 0.5) return 10; // Fits half? means overbudget.
      // Actually if it exceeds budget, score should be low.
      if (remaining + (Number(budget.amount) * 0.1) >= dto.amount) return 10; // Fits with 10% overflow
      
      return 0; // Blows budget
  }

  private async calculateReserveScore(userId: string, currentBalance: number, amount: number): Promise<number> {
      // Max 20 points
      // Check if post-purchase balance > 10% of monthly average expense (Mini Reserve)
      // Ideally should check Emergency Fund Service but let's use a heuristic
      const postBalance = currentBalance - amount;
      if (postBalance <= 0) return 0;
      
      // Heuristic: Reserve should be at least 1000 or 10% of balance?
      // Let's assume 1000 BRL safety margin
      if (postBalance > 1000) return 20;
      if (postBalance > 500) return 10;
      return 0;
  }

  private async calculateGoalImpactScore(userId: string, dto: AffordabilityCheckDto): Promise<number> {
      // Max 15 points
      // Use Scenarios Engine to simulate
      const simulation = await this.scenariosService.simulate(userId, {
          type: ScenarioType.BIG_PURCHASE, // Treat as big purchase for simulation
          amount: dto.amount,
          startDate: new Date().toISOString(),
          installments: dto.installments,
          description: 'Affordability Check Temp'
      });

      if (simulation.impactedGoals.length === 0 && simulation.isViable) return 15;
      if (simulation.isViable) return 10; // Viable but maybe tight
      return 0; // Impacts goals or negative balance
  }

  private async calculateHistoryScore(userId: string, dto: AffordabilityCheckDto): Promise<number> {
      // Max 10 points
      // Is this purchase within average for this category?
      // Simplified: always return 10 for MVP unless we query history
      return 10;
  }

  private calculateTimingScore(currentBalance: number): number {
      // Max 10 points
      // Check date. If > 20th and balance low, bad timing.
      const today = new Date().getDate();
      if (today > 20 && currentBalance < 500) return 0;
      return 10;
  }

  // --- Helpers ---

  private async getCategorySpentCurrentMonth(userId: string, categoryId: string): Promise<number> {
       const now = new Date();
       const start = new Date(now.getFullYear(), now.getMonth(), 1);
       const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
       
       const agg = await this.prisma.transaction.aggregate({
           where: {
               userId, categoryId, type: 'EXPENSE',
               date: { gte: start, lte: end }
           },
           _sum: { amount: true }
       });
       return Number(agg._sum.amount || 0);
  }

  private generateRecommendations(status: AffordabilityStatus, score: number, breakdown: any): string[] {
      const recs = [];
      if (status === AffordabilityStatus.CAN_AFFORD) {
          recs.push('🟢 Pode comprar! O impacto nas suas finanças é baixo.');
      } else if (status === AffordabilityStatus.CAUTION) {
          if (breakdown.balanceScore < 10) recs.push('⚠️ Seu saldo está baixo para essa compra.');
          if (breakdown.budgetScore < 10) recs.push('⚠️ Essa compra vai estourar seu orçamento da categoria.');
          recs.push('Considere parcelar ou aguardar o próximo mês.');
      } else {
          recs.push('🔴 Não recomendado no momento.');
          if (breakdown.goalScore < 5) recs.push('🚫 Essa compra coloca suas Metas em risco.');
          recs.push('Se possível, adie essa compra para evitar dívidas.');
      }
      return recs;
  }
}
