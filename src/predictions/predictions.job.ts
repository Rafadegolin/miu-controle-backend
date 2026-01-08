import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionEngineService } from './services/prediction-engine.service';

@Injectable()
export class PredictionsJob {
  private readonly logger = new Logger(PredictionsJob.name);

  constructor(
    private prisma: PrismaService,
    private predictionService: PredictionEngineService
  ) {}

  /**
   * Executa diariamente às 04:00 da manhã
   * Gera previsões de despesas variáveis para todos os usuários
   */
  @Cron('0 0 4 * * *') // Segundo 0, Minuto 0, Hora 4, Todo dia
  async handleMonthlyPredictions() {
    this.logger.log('Starting monthly variable expense predictions job...');
    
    // Buscar usuários ativos (que tiveram login nos últimos 30 dias ou criaram conta)
    const activeUsers = await this.prisma.user.findMany({
      select: { id: true },
      where: {
        // Opcional: filtrar apenas ativos para economizar recursos
        // lastLoginAt: { gte: thirtyDaysAgo } 
      }
    });

    this.logger.log(`Found ${activeUsers.length} users to process.`);

    const today = new Date();
    // A previsão é para "Este Mês" (ex: job roda 1 de Janeiro, prevê Janeiro)
    // E também fechamento do mês anterior (Dezembro) se tivessemos lógica de acurácia.
    const targetMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    for (const user of activeUsers) {
      try {
        await this.processUserPredictions(user.id, targetMonth);
      } catch (e) {
        this.logger.error(`Failed to process predictions for user ${user.id}: ${e.message}`);
      }
    }

    this.logger.log('Monthly predictions job finished.');
  }

  private async processUserPredictions(userId: string, targetMonth: Date) {
    // 1. Detectar categorias variáveis
    const variableCategories = await this.predictionService.detectVariableCategories(userId);
    
    if (variableCategories.length === 0) return;

    // 2. Para cada categoria, gerar previsão
    for (const categoryId of variableCategories) {
      const prediction = await this.predictionService.predictCategoryExpense(userId, categoryId, targetMonth);
      
      if (!prediction) continue;

      // 3. Salvar no banco
      await this.prisma.categoryPrediction.upsert({
        where: {
          userId_categoryId_month: {
            userId,
            categoryId,
            month: targetMonth
          }
        },
        update: {
          predicted: prediction.predictedAmount,
          confidence: prediction.confidence,
          lowerBound: prediction.lowerBound,
          upperBound: prediction.upperBound,
          factors: prediction.factors as any,
          updatedAt: new Date()
        },
        create: {
          userId,
          categoryId,
          month: targetMonth,
          predicted: prediction.predictedAmount,
          confidence: prediction.confidence,
          lowerBound: prediction.lowerBound,
          upperBound: prediction.upperBound,
          factors: prediction.factors as any
        }
      });
    }
  }
}
