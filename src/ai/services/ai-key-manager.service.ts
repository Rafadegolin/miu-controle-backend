import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { AiFeatureType } from '@prisma/client';

/**
 * Service to manage AI API keys and model selection
 * Handles logic for FREE vs PAID tiers and granular model configuration
 */
@Injectable()
export class AiKeyManagerService {
  private readonly logger = new Logger(AiKeyManagerService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {}

  /**
   * Get API key and config for a specific feature
   * @param userId User ID
   * @param feature Feature being used (CATEGORIZATION or ANALYTICS)
   */
  async getApiKey(
    userId: string,
    feature: AiFeatureType | 'CATEGORIZATION' | 'ANALYTICS',
  ): Promise<{
    apiKey: string;
    isCorporate: boolean;
    provider: 'OPENAI' | 'GEMINI';
    model: string;
  }> {
    // 1. Get user config and subscription
    const [aiConfig, user] = await Promise.all([
      this.prisma.userAiConfig.findUnique({ where: { userId } }),
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscription: {
            select: { plan: true },
          },
        },
      }),
    ]);

    // 2. Determine model based on feature
    let selectedModel = '';
    
    // Map features to model config types
    if ((feature as string) === 'CATEGORIZATION' || feature === AiFeatureType.CATEGORIZATION) {
       selectedModel = aiConfig?.categorizationModel || 'gpt-4o-mini';
    } else if ((feature as string) === 'RECOMMENDATIONS' || feature === AiFeatureType.RECOMMENDATIONS) { // 🆕
       selectedModel = aiConfig?.recommendationModel || 'gpt-4o-mini';
    } else {
       // PREDICTIVE_ANALYTICS, ANALYTICS, etc defaults to analyticsModel
       selectedModel = aiConfig?.analyticsModel || 'gemini-1.5-flash';
    }

    // 3. Determine provider from model name
    const provider = selectedModel.startsWith('gpt') ? 'OPENAI' : 'GEMINI';

    // 4. Determine corporate key usage
    const isPaidTier = user?.subscription?.plan === 'PRO' || user?.subscription?.plan === 'FAMILY';
    const usesCorporate = aiConfig?.usesCorporateKey || isPaidTier;

    // 5. Get appropriate API key
    if (usesCorporate) {
      // PAID tier: Use corporate keys
      const corporateKey = this.getCorporateKey(provider);
      
      if (!corporateKey) {
        throw new Error(
          `Chave corporativa ${provider} não configurada. Contate o suporte.`,
        );
      }

      this.logger.debug(`Using corporate ${provider} key for user ${userId} (${feature})`);

      return {
        apiKey: corporateKey,
        isCorporate: true,
        provider,
        model: selectedModel,
      };
    } else {
      // FREE tier: Use user's own key
      if (!aiConfig) {
        throw new Error('IA não configurada. Configure em Configurações > IA.');
      }

      const encryptedKey =
        provider === 'OPENAI'
          ? aiConfig.openaiApiKeyEncrypted
          : aiConfig.geminiApiKeyEncrypted;

      if (!encryptedKey) {
        throw new Error(
          `API key ${provider} não configurada. Configure para usar o modelo ${selectedModel}.`,
        );
      }

      const decryptedKey = this.encryptionService.decrypt(encryptedKey);

      // Check token limit for FREE users
      await this.checkTokenLimit(userId, aiConfig.monthlyTokenLimit);

      return {
        apiKey: decryptedKey,
        isCorporate: false,
        provider,
        model: selectedModel,
      };
    }
  }

  /**
   * Get corporate API key from environment variables
   */
  private getCorporateKey(provider: 'OPENAI' | 'GEMINI'): string | null {
    const key =
      provider === 'OPENAI'
        ? this.configService.get<string>('CORPORATE_OPENAI_KEY')
        : this.configService.get<string>('CORPORATE_GEMINI_KEY');

    return key || null;
  }

  /**
   * Check if user has exceeded monthly token limit (FREE tier only)
   */
  private async checkTokenLimit(userId: string, customLimit?: number): Promise<void> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usage = await this.prisma.aiUsageMetric.aggregate({
      where: {
        userId,
        timestamp: { gte: startOfMonth },
      },
      _sum: { totalTokens: true },
    });

    const totalTokens = usage._sum.totalTokens || 0;
    const limit = customLimit || 1_000_000; // Default 1M tokens

    if (totalTokens >= limit) {
      throw new Error(
        `Limite mensal de tokens excedido (${totalTokens}/${limit}). Faça upgrade para PRO ou aguarde o próximo mês.`,
      );
    }
  }
}
