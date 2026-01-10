import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { Cron, CronExpression } from '@nestjs/schedule';
import { ExpenseReducerAnalyzer } from './analyzers/expense-reducer.analyzer';
import { SubscriptionReviewerAnalyzer } from './analyzers/subscription-reviewer.analyzer';
import { BudgetOptimizerAnalyzer } from './analyzers/budget-optimizer.analyzer';
import { OpportunityDetectorAnalyzer } from './analyzers/opportunity-detector.analyzer';
import { RiskAlertAnalyzer } from './analyzers/risk-alert.analyzer';
import { RecommendationType, RecommendationStatus } from '@prisma/client';
import { AnalyzerResult } from './analyzers/analyzer.interface';


import { GeminiService } from '../ai/services/gemini.service';
import { OpenAiService } from '../ai/services/openai.service';
import { AiKeyManagerService } from '../ai/services/ai-key-manager.service';
import { AiFeatureType } from '@prisma/client';

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly openAiService: OpenAiService,
    private readonly aiKeyManagerService: AiKeyManagerService,
    private readonly expenseReducer: ExpenseReducerAnalyzer,
    private readonly subscriptionReviewer: SubscriptionReviewerAnalyzer,
    private readonly budgetOptimizer: BudgetOptimizerAnalyzer,
    private readonly opportunityDetector: OpportunityDetectorAnalyzer,
    private readonly riskAlert: RiskAlertAnalyzer,
  ) {}

  async findAll(userId: string) {
    return this.prisma.recommendation.findMany({
      where: { 
        userId,
        status: 'ACTIVE',
      },
      orderBy: {
        priority: 'desc',
      },
    });
  }

  @Cron(CronExpression.EVERY_WEEK) // Domingo 20h = Ajustar para '0 20 * * 0' se necessário, mas EVERY_WEEK roda domingo meia-noite por padrão
  async generateRecommendationsJob() {
    this.logger.log('Starting weekly recommendation generation job...');
    const users = await this.prisma.user.findMany({
      where: { 
        accounts: { some: {} } // Usuários ativos com contas
      }, 
      select: { id: true }
    });

    for (const user of users) {
      await this.generateRecommendationsForUser(user.id);
    }
    this.logger.log(`Generated recommendations for ${users.length} users.`);
  }

  async generateRecommendationsForUser(userId: string) {
    // 1. Limpar (ou expirar) recomendações antigas
    await this.prisma.recommendation.updateMany({
      where: { userId, status: 'ACTIVE',  createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, // > 30 dias
      data: { status: 'EXPIRED' }
    });

    // 2. Verificar limite (máximo 5 ativas)
    const activeCount = await this.prisma.recommendation.count({ where: { userId, status: 'ACTIVE' } });
    if (activeCount >= 5) return;

    // 3. Executar analisadores
    const allResults: AnalyzerResult[] = [];
    
    try {
      allResults.push(...await this.expenseReducer.analyze(userId));
      allResults.push(...await this.subscriptionReviewer.analyze(userId));
      allResults.push(...await this.budgetOptimizer.analyze(userId));
      allResults.push(...await this.opportunityDetector.analyze(userId));
      allResults.push(...await this.riskAlert.analyze(userId));
    } catch (error) {
      this.logger.error(`Error analyzing recommendations for user ${userId}:`, error);
      return;
    }

    if (allResults.length === 0) return;

    // 4. Calcular Score e Gravar
    // Buscar config de IA via Manager
    let aiConfig = null;
    try {
      aiConfig = await this.aiKeyManagerService.getApiKey(userId, AiFeatureType.RECOMMENDATIONS);
    } catch (e) {
      // Silenciosamente ignora erro de config (usa texto padrão)
      // this.logger.debug(`AI not configured for user ${userId}: ${e.message}`);
    }

    for (const res of allResults) {
      // Evitar duplicatas (mesmo tipo e categoria ativa)
      const duplicate = await this.prisma.recommendation.findFirst({
        where: { userId, status: 'ACTIVE', type: res.type, category: res.category }
      });
      if (duplicate) continue;

      let description = res.description;
      if (aiConfig) {
        // Refinar com IA
        description = await this.refineDescription(res.description, aiConfig.model, aiConfig.apiKey);
      }

      const priority = this.calculatePriorityScore(res.impact, res.difficulty);

      await this.prisma.recommendation.create({
        data: {
          userId,
          type: res.type,
          title: res.title,
          description, 
          impact: res.impact,
          difficulty: res.difficulty,
          priority,
          category: res.category,
          status: 'ACTIVE',
        }
      });
      
      // Checar limite novamente para não exceder no loop
      const currentCount = await this.prisma.recommendation.count({ where: { userId, status: 'ACTIVE' } });
      if (currentCount >= 5) break; 
    }
  }

  private async refineDescription(text: string, model: string, apiKey: string): Promise<string> {
    if (model.startsWith('gemini')) {
      return this.geminiService.enhanceText(text, apiKey);
    } else {
      return this.openAiService.enhanceText(text, apiKey, model);
    }
  }

  private calculatePriorityScore(impact: number, difficulty: number): number {
    return Math.round((impact * 0.6) + ((6 - difficulty) * 0.4) * 20);
  }

  async applyRecommendation(userId: string, recommendationId: string) {
    const rec = await this.prisma.recommendation.findUnique({ where: { id: recommendationId, userId } });
    if (!rec) throw new NotFoundException('Recommendation not found');

    // Lógica de "Aplicação Automática"
    // Depende do metadata, mas por simplicidade vamos apenas marcar como aplicado
    // Para evoluir: usar Strategy Pattern para executar ação baseada no tipo.

    return this.prisma.recommendation.update({
      where: { id: recommendationId },
      data: { 
        status: 'APPLIED',
        appliedAt: new Date(),
      }
    });
  }

  async dismissRecommendation(userId: string, recommendationId: string) {
    return this.prisma.recommendation.update({
      where: { id: recommendationId, userId },
      data: { 
        status: 'DISMISSED',
        dismissedAt: new Date(),
      }
    });
  }
}
