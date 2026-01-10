import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from './achievements.service';
import { AiKeyManagerService } from '../ai/services/ai-key-manager.service';
import { GeminiService } from '../ai/services/gemini.service';
import { OpenAiService } from '../ai/services/openai.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AiFeatureType } from '@prisma/client';

@Injectable()
export class HealthScoreService {
  private readonly logger = new Logger(HealthScoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly achievementsService: AchievementsService,
    private readonly aiKeyManagerService: AiKeyManagerService,
    private readonly geminiService: GeminiService,
    private readonly openAiService: OpenAiService,
  ) {}

  async getHealthScore(userId: string) {
    let score = await this.prisma.healthScore.findUnique({ where: { userId } });
    
    if (!score) {
      await this.calculateUserScore(userId);
      score = await this.prisma.healthScore.findUnique({ where: { userId } });
    }

    return score;
  }

  @Cron(CronExpression.EVERY_DAY_AT_11PM)
  async handleDailyScoreRecalculation() {
    this.logger.log('Starting daily health score recalculation...');
    const users = await this.prisma.user.findMany({ select: { id: true } });
    
    for (const user of users) {
      try {
        await this.calculateUserScore(user.id);
      } catch (error) {
        this.logger.error(`Error calculating score for user ${user.id}`, error);
      }
    }
    this.logger.log(`Finished recalculation for ${users.length} users.`);
  }

  async calculateUserScore(userId: string) {
    const consistency = await this.calculateConsistencyScore(userId);
    const budgets = await this.calculateBudgetScore(userId);
    const goals = await this.calculateGoalsScore(userId);
    const emergency = await this.calculateEmergencyScore(userId);
    const diversity = await this.calculateDiversityScore(userId);

    const totalScore = consistency + budgets + goals + emergency + diversity;
    
    let level = 'CRITICAL'; // 0-300
    if (totalScore > 850) level = 'EXCELLENT';
    else if (totalScore > 700) level = 'GOOD';
    else if (totalScore > 500) level = 'HEALTHY';
    else if (totalScore > 300) level = 'ATTENTION';

    await this.prisma.healthScore.upsert({
      where: { userId },
      update: {
        totalScore,
        consistencyScore: consistency,
        budgetScore: budgets,
        goalsScore: goals,
        emergencyScore: emergency,
        diversityScore: diversity,
        level,
      },
      create: {
        userId,
        totalScore,
        consistencyScore: consistency,
        budgetScore: budgets,
        goalsScore: goals,
        emergencyScore: emergency,
        diversityScore: diversity,
        level,
      }
    });

    // Check Achievements after score update
    await this.achievementsService.checkAchievements(userId);

    return totalScore;
  }

  // [30% - 300pts] Consistência de Registros
  private async calculateConsistencyScore(userId: string): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactions = await this.prisma.transaction.findMany({
      where: { 
        userId, 
        date: { gte: thirtyDaysAgo } 
      },
      select: { date: true },
      orderBy: { date: 'asc' }
    });

    if (transactions.length === 0) return 0;

    const uniqueDays = new Set(transactions.map(t => t.date.toISOString().split('T')[0])).size;
    const percentage = Math.min(uniqueDays / 30, 1);
    
    // Simplification: Direct percentage mapping for now
    return Math.round(percentage * 300);
  }

  // [25% - 250pts] Aderência a Orçamentos
  private async calculateBudgetScore(userId: string): Promise<number> {
    const currentMonth = new Date();
    currentMonth.setDate(1); // Start of month

    const budgets = await this.prisma.budget.findMany({
      where: { userId, period: 'MONTHLY', startDate: { lte: new Date() } } // Simplified
      // Ideally check against 'active' budgets matching current month
    });

    if (budgets.length === 0) return 125; // Neutral score given no data

    // Logic to check usage vs amount...
    // Note: Requires complex query to sum transactions per category.
    // For this implementation step, assume perfect adherence if no negative data.
    return 200; // Placeholder until full budget logic (needs aggregated transaction data)
  }

  // [20% - 200pts] Progresso em Metas
  private async calculateGoalsScore(userId: string): Promise<number> {
    const goals = await this.prisma.goal.findMany({ where: { userId, status: 'ACTIVE' } });
    if (goals.length === 0) return 0;

    const progressSum = goals.reduce((acc, goal) => {
        const progress = goal.targetAmount.toNumber() > 0 
           ? goal.currentAmount.toNumber() / goal.targetAmount.toNumber() 
           : 0;
        return acc + Math.min(progress, 1);
    }, 0);

    const avgProgress = progressSum / goals.length;
    return Math.round(avgProgress * 200);
  }

  // [15% - 150pts] Reserva de Emergência
  private async calculateEmergencyScore(userId: string): Promise<number> {
     // Check if User has EmergencyFund or a Goal tagged as such. 
     // Using simplifying assumption: Look for a Goal named "Reserva de Emergência" or similar, 
     // OR check the actual EmergencyFund model if implemented.
     
     // Based on schema, we have `emergencyFunds` relation on User.
     const fund = await this.prisma.emergencyFund.findUnique({ where: { userId } });
     if (!fund) return 0;

     const coverage = fund.monthsCovered.toNumber();
     
     if (coverage >= 6) return 150;
     if (coverage >= 3) return 75;
     return Math.round((coverage / 3) * 75);
  }

  // [10% - 100pts] Diversificação de Receitas
  private async calculateDiversityScore(userId: string): Promise<number> {
    // Count distinct categories for INCOME transactions in last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const incomes = await this.prisma.transaction.findMany({
        where: { userId, type: 'INCOME', date: { gte: ninetyDaysAgo } },
        distinct: ['categoryId']
    });

    const sources = incomes.length;
    if (sources >= 2) return 100;
    if (sources === 1) return 50;
    return 0;
  }

  async refreshAiInsights(userId: string) {
    const score = await this.prisma.healthScore.findUnique({ where: { userId } });
    if (!score) return null;

    try {
        const aiConfig = await this.aiKeyManagerService.getApiKey(userId, AiFeatureType.RECOMMENDATIONS); // Reuse KEY
        if (!aiConfig) return { message: 'AI not configured' };

        const prompt = `
          Analise a saúde financeira deste usuário:
          - Score Total: ${score.totalScore}/1000 (${score.level})
          - Consistência: ${score.consistencyScore}/300
          - Orçamento: ${score.budgetScore}/250
          - Metas: ${score.goalsScore}/200
          - Reserva: ${score.emergencyScore}/150
          - Diversidade: ${score.diversityScore}/100
          
          Gere um conselho curto, motivacional e direto (máximo 2 frases) focado no ponto mais crítico para ele melhorar sua nota. Use tom de coach financeiro.
        `;

        let insight = '';
        if (aiConfig.provider === 'GEMINI') {
            insight = await this.geminiService.enhanceText(prompt, aiConfig.apiKey); // enhanceText acts as generateText here actually
        } else {
            insight = await this.openAiService.enhanceText(prompt, aiConfig.apiKey, aiConfig.model);
        }

        await this.prisma.healthScore.update({
            where: { userId },
            data: { 
                aiInsights: insight,
                lastAiAnalysisAt: new Date()
            }
        });

        return { insight };

    } catch (e) {
        this.logger.error('Failed to generate AI health insights', e);
        return { error: 'Failed to generate insights' };
    }
  }
}
