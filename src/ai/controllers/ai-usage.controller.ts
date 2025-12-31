import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AiUsageService } from '../services/ai-usage.service';

/**
 * Controller for AI usage statistics
 * Provides endpoints to view token consumption and categorization accuracy
 */
@ApiTags('AI Usage & Stats')
@Controller('ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiUsageController {
  constructor(private aiUsageService: AiUsageService) {}

  /**
   * Get monthly usage statistics
   */
  @Get('usage-stats')
  @ApiOperation({
    summary: 'Get monthly AI usage statistics',
    description: 'Returns token consumption, costs, and breakdown by feature',
  })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved' })
  async getUsageStats(@CurrentUser('id') userId: string) {
    const usage = await this.aiUsageService.getMonthlyUsage(userId);

    return {
      month: new Date().toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      }),
      totalTokens: usage.totalTokens,
      totalCost: parseFloat(usage.totalCost.toFixed(6)),
      totalCostBRL: parseFloat((usage.totalCost * 5.5).toFixed(2)), // Approximate conversion
      byFeature: usage.byFeature,
    };
  }

  /**
   * Get categorization performance statistics
   */
  @Get('categorization-stats')
  @ApiOperation({
    summary: 'Get AI categorization performance stats',
    description:
      'Returns accuracy, confidence metrics, and correction rate',
  })
  @ApiResponse({ status: 200, description: 'Categorization stats retrieved' })
  async getCategorizationStats(@CurrentUser('id') userId: string) {
    const stats = await this.aiUsageService.getCategorizationStats(userId);

    return {
      totalPredictions: stats.totalPredictions,
      averageConfidence: parseFloat(stats.averageConfidence.toFixed(2)),
      accuracy: parseFloat((stats.accuracy * 100).toFixed(1)), // As percentage
      correctionRate: parseFloat((stats.correctionRate * 100).toFixed(1)), // As percentage
      message:
        stats.totalPredictions === 0
          ? 'Nenhuma categorização realizada ainda'
          : `${stats.totalPredictions} transações categorizadas com ${(stats.accuracy * 100).toFixed(0)}% de precisão`,
    };
  }
}
