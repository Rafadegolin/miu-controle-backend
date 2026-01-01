import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiFeatureType } from '@prisma/client';

/**
 * Service for tracking and managing AI usage metrics
 * 
 * Responsibilities:
 * - Track token usage per feature
 * - Calculate costs
 * - Check monthly limits
 * - Generate usage statistics
 */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Track AI usage for a specific feature
   * @param userId - User ID
   * @param feature - AI feature used
   * @param usage - OpenAI usage object
   * @param model - Model used
   * @param relatedEntityId - Optional ID of related entity (e.g., transactionId)
   */
  async trackUsage(
    userId: string,
    feature: AiFeatureType,
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    },
    model: string,
    relatedEntityId?: string,
  ): Promise<void> {
    try {
      // Calculate cost based on model
      const estimatedCost = this.calculateCostForModel(
        model,
        usage.prompt_tokens,
        usage.completion_tokens,
      );

      await this.prisma.aiUsageMetric.create({
        data: {
          userId,
          feature,
          model,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          estimatedCost,
          relatedEntityId,
          success: true,
        },
      });

      this.logger.debug(
        `Tracked AI usage: user=${userId}, feature=${feature}, tokens=${usage.total_tokens}, cost=$${estimatedCost.toFixed(6)}`,
      );
    } catch (error) {
      this.logger.error('Failed to track AI usage:', error.message);
      // Don't throw - tracking failure shouldn't break the main flow
    }
  }

  /**
   * Track failed AI request
   * @param userId - User ID
   * @param feature - AI feature
   * @param model - Model that was attempted
   * @param errorMessage - Error message
   */
  async trackFailure(
    userId: string,
    feature: AiFeatureType,
    model: string,
    errorMessage: string,
  ): Promise<void> {
    try {
      await this.prisma.aiUsageMetric.create({
        data: {
          userId,
          feature,
          model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
          success: false,
          errorMessage: errorMessage.substring(0, 500), // Limit error message length
        },
      });
    } catch (error) {
      this.logger.error('Failed to track AI failure:', error.message);
    }
  }

  /**
   * Get monthly usage statistics for a user
   * @param userId - User ID
   * @returns Usage statistics
   */
  async getMonthlyUsage(userId: string): Promise<{
    totalTokens: number;
    totalCost: number;
    byFeature: Record<string, { tokens: number; cost: number; requests: number }>;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const metrics = await this.prisma.aiUsageMetric.findMany({
      where: {
        userId,
        timestamp: {
          gte: startOfMonth,
        },
      },
    });

    const totalTokens = metrics.reduce((sum, m) => sum + m.totalTokens, 0);
    const totalCost = metrics.reduce(
      (sum, m) => sum + parseFloat(m.estimatedCost.toString()),
      0,
    );

    const byFeature: Record<string, { tokens: number; cost: number; requests: number }> = {};

    for (const metric of metrics) {
      if (!byFeature[metric.feature]) {
        byFeature[metric.feature] = { tokens: 0, cost: 0, requests: 0 };
      }

      byFeature[metric.feature].tokens += metric.totalTokens;
      byFeature[metric.feature].cost += parseFloat(metric.estimatedCost.toString());
      byFeature[metric.feature].requests += 1;
    }

    return {
      totalTokens,
      totalCost,
      byFeature,
    };
  }

  /**
   * Check if user has reached their monthly token limit
   * @param userId - User ID
   * @returns true if under limit, false if exceeded
   */
  async checkMonthlyLimit(userId: string): Promise<boolean> {
    // Get user's AI config
    const aiConfig = await this.prisma.userAiConfig.findUnique({
      where: { userId },
    });

    if (!aiConfig || !aiConfig.monthlyTokenLimit) {
      return true; // No limit set
    }

    const usage = await this.getMonthlyUsage(userId);

    return usage.totalTokens < aiConfig.monthlyTokenLimit;
  }

  /**
   * Calculate cost based on model pricing
   * @param model - Model name
   * @param promptTokens - Prompt tokens
   * @param completionTokens - Completion tokens
   * @returns Estimated cost in USD
   */
  private calculateCostForModel(
    model: string,
    promptTokens: number,
    completionTokens: number,
  ): number {
    // Pricing per 1M tokens (as of December 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o-mini': { input: 0.15, output: 0.60 },
      'gpt-4o': { input: 5.0, output: 15.0 },
      'gpt-4-turbo': { input: 10.0, output: 30.0 },
      'gpt-4': { input: 30.0, output: 60.0 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
      // Gemini Pricing (Approx. Dec 2024)
      'gemini-1.5-flash': { input: 0.075, output: 0.30 },
      'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    };

    // Default to gpt-4o-mini pricing if model not found
    const modelPricing = pricing[model] || pricing['gpt-4o-mini'];

    const promptCost = (promptTokens / 1_000_000) * modelPricing.input;
    const completionCost = (completionTokens / 1_000_000) * modelPricing.output;

    return promptCost + completionCost;
  }

  /**
   * Get categorization statistics for a user
   * @param userId - User ID
   * @returns Categorization stats
   */
  async getCategorizationStats(userId: string): Promise<{
    totalPredictions: number;
    averageConfidence: number;
    accuracy: number; // Based on feedback
    correctionRate: number;
  }> {
    // Get all categorization metrics
    const metrics = await this.prisma.aiUsageMetric.findMany({
      where: {
        userId,
        feature: 'CATEGORIZATION',
        success: true,
      },
    });

    // Get feedbacks (corrections)
    const feedbacks = await this.prisma.aiCategorizationFeedback.findMany({
      where: { userId },
    });

    const totalPredictions = metrics.length;
    
    // Calculate average confidence from feedbacks
    const avgConfidence = feedbacks.length > 0
      ? feedbacks.reduce((sum, f) => sum + parseFloat(f.aiConfidence.toString()), 0) / feedbacks.length
      : 0;

    // Calculate accuracy (how many were correct)
    const correctPredictions = feedbacks.filter(f => f.wasCorrect).length;
    const accuracy = feedbacks.length > 0 ? correctPredictions / feedbacks.length : 0;

    // Correction rate (how many times user corrected)
    const correctionRate = totalPredictions > 0
      ? feedbacks.filter(f => !f.wasCorrect).length / totalPredictions
      : 0;

    return {
      totalPredictions,
      averageConfidence: avgConfidence,
      accuracy,
      correctionRate,
    };
  }
}
