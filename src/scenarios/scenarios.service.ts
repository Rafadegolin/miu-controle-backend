import { Injectable, Logger } from '@nestjs/common';
import { AnalysisService } from '../analysis/analysis.service';
import { GoalsService } from '../goals/goals.service';
import { PlanningService } from '../planning/planning.service';
import { PrismaService } from '../prisma/prisma.service'; // Import Prisma
import { SimulateScenarioDto, ScenarioType } from './dto/simulate-scenario.dto';
import { ScenarioResultDto } from './dto/scenario-result.dto';
import { AffordabilityCheckDto } from './dto/affordability-check.dto';
import {
  AffordabilityResultDto,
  AffordabilityStatus,
} from './dto/affordability-result.dto';

@Injectable()
export class ScenariosService {
  private readonly logger = new Logger(ScenariosService.name);

  constructor(
    private analysisService: AnalysisService,
    private goalsService: GoalsService,
    private planningService: PlanningService,
    private prisma: PrismaService, // Inject Prisma
  ) {}

  async simulate(
    userId: string,
    dto: SimulateScenarioDto,
  ): Promise<ScenarioResultDto> {
    this.logger.log(`Simulating scenario ${dto.type} for user ${userId}`);

    // 1. Get Baseline (Average 3 months)
    const baseline = await this.getBaseline(userId);

    // Get Current Total Balance
    const accounts = await this.prisma.account.findMany({ where: { userId } });
    const currentBalance = accounts.reduce(
      (sum, acc) => sum + Number(acc.currentBalance),
      0,
    );

    // 2. Project 12 Months (Baseline)
    const baseProjection = this.projectCashFlow(
      currentBalance,
      baseline.surplus,
      12,
    );

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
          message:
            'Aumente o número de parcelas para reduzir o impacto mensal.',
        });
      } else if (dto.type === ScenarioType.BIG_PURCHASE) {
        recommendations.push({
          type: 'INSTALLMENT',
          message: 'Considere parcelar esta compra.',
        });
      }

      recommendations.push({
        type: 'DELAY',
        message: 'Saldo ficará negativo. Considere adiar esta decisão.',
      });

      // Sugere cortes REAIS em categorias não essenciais (motor compartilhado
      // com o PlanningService, em vez de uma mensagem genérica).
      const shortfall = Math.abs(lowestBalance);
      const cuts = await this.planningService.suggestCuts(userId, shortfall);
      if (cuts.length > 0) {
        const cutList = cuts
          .map((c) => `${c.categoryName} (R$ ${c.amount.toFixed(2)})`)
          .join(', ');
        recommendations.push({
          type: 'CUT',
          message: `Cortes em categorias não essenciais podem viabilizar: ${cutList}.`,
        });
      }
    }

    // Metas impactadas (motor real: saldo negativo coloca todas em risco)
    const impactedGoals = await this.detectGoalImpact(
      userId,
      scenarioProjection,
    );

    return {
      isViable,
      currentBalance,
      projectedBalance12Months: scenarioProjection,
      lowestBalance,
      impactedGoals,
      recommendations,
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
        status: 'COMPLETED',
      },
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
      surplus: (income - expense) / 3,
    };
  }

  private projectCashFlow(
    startBalance: number,
    monthlySurplus: number,
    months: number,
  ): number[] {
    const projection = [];
    let current = startBalance;
    for (let i = 0; i < months; i++) {
      current += monthlySurplus;
      projection.push(current);
    }
    return projection;
  }

  private applyScenario(
    projection: number[],
    dto: SimulateScenarioDto,
  ): number[] {
    const newProjection = [...projection];

    if (
      dto.type === ScenarioType.BIG_PURCHASE ||
      dto.type === ScenarioType.EMERGENCY_EXPENSE ||
      dto.type === ScenarioType.DEBT_PAYMENT
    ) {
      if (dto.installments && dto.installments > 1) {
        const installmentValue = dto.amount / dto.installments;
        for (let i = 0; i < projection.length; i++) {
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
        newProjection.forEach((_, idx) => (newProjection[idx] -= dto.amount));
      }
    } else if (dto.type === ScenarioType.INCOME_LOSS) {
      // Reduce monthly surplus from start date
      // projection[i] = projection[i-1] + (surplus - loss)
      // Simplified:
      newProjection.forEach(
        (_, idx) => (newProjection[idx] -= dto.amount * (idx + 1)),
      );
    } else if (dto.type === ScenarioType.NEW_RECURRING) {
      newProjection.forEach(
        (_, idx) => (newProjection[idx] -= dto.amount * (idx + 1)),
      );
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

  // ==================== VIABILIDADE DE COMPRA (fundido do antigo módulo affordability) ====================
  // "Posso comprar isto?" é um caso especial de simulação: usa o motor simulate()
  // para medir o impacto e combina com um scoring de 6 critérios (0-100).

  async checkAffordability(
    userId: string,
    dto: AffordabilityCheckDto,
  ): Promise<AffordabilityResultDto> {
    // 1. Fetch Context Data
    const accounts = await this.prisma.account.findMany({ where: { userId } });
    const currentBalance = accounts.reduce(
      (sum, acc) => sum + Number(acc.currentBalance),
      0,
    );

    const budget = await this.prisma.budget.findFirst({
      where: { userId, categoryId: dto.categoryId, period: 'MONTHLY' },
      orderBy: { startDate: 'desc' },
    });

    // 2. Calculate Scores
    const balanceScore = this.calculateBalanceScore(currentBalance, dto.amount);
    const budgetScore = await this.calculateBudgetScore(userId, dto, budget);
    const reserveScore = await this.calculateReserveScore(
      userId,
      currentBalance,
      dto.amount,
    );
    const goalScore = await this.calculateGoalImpactScore(userId, dto);
    const historyScore = await this.calculateHistoryScore(userId, dto);
    const timingScore = this.calculateTimingScore(currentBalance);

    const totalScore =
      balanceScore +
      budgetScore +
      reserveScore +
      goalScore +
      historyScore +
      timingScore;
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
    const recommendations = this.generateAffordabilityRecommendations(
      status,
      finalScore,
      { balanceScore, budgetScore, goalScore },
    );

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
        timingScore,
      },
      recommendations,
    };
  }

  private calculateBalanceScore(balance: number, amount: number): number {
    // Max 25 points
    if (balance >= amount) return 25;
    if (balance >= amount * 0.8) return 15; // Covers 80%
    if (balance >= amount * 0.5) return 5;
    return 0;
  }

  private async calculateBudgetScore(
    userId: string,
    dto: AffordabilityCheckDto,
    budget: any,
  ): Promise<number> {
    // Max 20 points
    if (!budget) return 20; // Sem orçamento = neutro

    const spent = await this.getCategorySpentCurrentMonth(
      userId,
      dto.categoryId,
    );
    const remaining = Number(budget.amount) - spent;

    if (remaining >= dto.amount) return 20; // Cabe no orçamento
    if (remaining + Number(budget.amount) * 0.1 >= dto.amount) return 10; // Cabe com 10% de overflow
    return 0; // Estoura o orçamento
  }

  private async calculateReserveScore(
    userId: string,
    currentBalance: number,
    amount: number,
  ): Promise<number> {
    // Max 20 points — saldo pós-compra como colchão de segurança
    const postBalance = currentBalance - amount;
    if (postBalance <= 0) return 0;
    if (postBalance > 1000) return 20;
    if (postBalance > 500) return 10;
    return 0;
  }

  private async calculateGoalImpactScore(
    userId: string,
    dto: AffordabilityCheckDto,
  ): Promise<number> {
    // Max 15 points — usa o próprio motor de simulação
    const simulation = await this.simulate(userId, {
      type: ScenarioType.BIG_PURCHASE,
      amount: dto.amount,
      startDate: new Date().toISOString(),
      installments: dto.installments,
      description: 'Affordability Check Temp',
    });

    if (simulation.impactedGoals.length === 0 && simulation.isViable) return 15;
    if (simulation.isViable) return 10; // Viável, mas apertado
    return 0; // Impacta metas ou fica negativo
  }

  private async calculateHistoryScore(
    userId: string,
    dto: AffordabilityCheckDto,
  ): Promise<number> {
    // Max 10 points — quão "típica" é essa compra para a categoria, comparada
    // à média de gasto por transação da categoria nos últimos 3 meses.
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 3);

    const agg = await this.prisma.transaction.aggregate({
      where: {
        userId,
        categoryId: dto.categoryId,
        type: 'EXPENSE',
        date: { gte: start, lte: end },
      },
      _avg: { amount: true },
      _count: true,
    });

    const avg = Number(agg._avg.amount || 0);
    if (agg._count === 0 || avg <= 0) return 8; // Sem histórico → neutro
    if (dto.amount <= avg) return 10; // Dentro do padrão
    if (dto.amount <= avg * 2) return 6; // Acima da média
    return 3; // Bem acima do padrão da categoria
  }

  private calculateTimingScore(currentBalance: number): number {
    // Max 10 points — fim do mês com saldo baixo = mau timing
    const today = new Date().getDate();
    if (today > 20 && currentBalance < 500) return 0;
    return 10;
  }

  private async getCategorySpentCurrentMonth(
    userId: string,
    categoryId: string,
  ): Promise<number> {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const agg = await this.prisma.transaction.aggregate({
      where: {
        userId,
        categoryId,
        type: 'EXPENSE',
        date: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount || 0);
  }

  private generateAffordabilityRecommendations(
    status: AffordabilityStatus,
    score: number,
    breakdown: any,
  ): string[] {
    const recs: string[] = [];
    if (status === AffordabilityStatus.CAN_AFFORD) {
      recs.push('🟢 Pode comprar! O impacto nas suas finanças é baixo.');
    } else if (status === AffordabilityStatus.CAUTION) {
      if (breakdown.balanceScore < 10)
        recs.push('⚠️ Seu saldo está baixo para essa compra.');
      if (breakdown.budgetScore < 10)
        recs.push('⚠️ Essa compra vai estourar seu orçamento da categoria.');
      recs.push('Considere parcelar ou aguardar o próximo mês.');
    } else {
      recs.push('🔴 Não recomendado no momento.');
      if (breakdown.goalScore < 5)
        recs.push('🚫 Essa compra coloca suas Metas em risco.');
      recs.push('Se possível, adie essa compra para evitar dívidas.');
    }
    return recs;
  }
}
