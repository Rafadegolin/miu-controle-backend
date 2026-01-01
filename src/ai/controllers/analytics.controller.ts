import { Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PredictiveAnalyticsService } from '../services/predictive-analytics.service';
import { AnomalyQueryDto } from '../dto/anomaly-query.dto';

/**
 * Controller for AI Analytics
 */
@ApiTags('AI Analytics')
@Controller('ai/analytics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private analyticsService: PredictiveAnalyticsService) {}

  @Get('forecast')
  @ApiOperation({ summary: 'Generate financial forecast for next month' })
  @ApiResponse({ status: 200, description: 'Forecast generated' })
  async getForecast(@CurrentUser('id') userId: string) {
    return this.analyticsService.generateForecast(userId);
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'List detected anomalies' })
  @ApiResponse({ status: 200, description: 'List of anomalies' })
  async getAnomalies(
    @CurrentUser('id') userId: string,
    @Query() query: AnomalyQueryDto,
  ) {
    return this.analyticsService.getAnomalies(userId, query);
  }

  @Post('anomalies/:id/dismiss')
  @ApiOperation({ summary: 'Dismiss an anomaly' })
  @ApiResponse({ status: 200, description: 'Anomaly dismissed' })
  async dismissAnomaly(
    @CurrentUser('id') userId: string,
    @Param('id') anomalyId: string,
  ) {
    return this.analyticsService.dismissAnomaly(userId, anomalyId);
  }

  @Get('financial-health')
  @ApiOperation({ summary: 'Calculate Financial Health Score (0-100)' })
  async getFinancialHealth(@CurrentUser('id') userId: string) {
    return this.analyticsService.calculateFinancialHealthScore(userId);
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get financial trends (3M, 6M, 1Y)' })
  async getTrends(
    @CurrentUser('id') userId: string,
    @Query('period') period: '3M' | '6M' | '1Y' = '6M',
  ) {
    return this.analyticsService.calculateTrendsAnalysis(userId, period);
  }

  @Get('goal-forecast/:goalId')
  @ApiOperation({ summary: 'Forecast goal achievement date' })
  async getGoalForecast(
    @CurrentUser('id') userId: string, // Not used inside but needed for security context if needed
    @Param('goalId') goalId: string,
  ) {
    return this.analyticsService.forecastGoalAchievement(goalId);
  }
}
