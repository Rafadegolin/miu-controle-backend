import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { HealthScoreService } from './health-score.service';
import { AchievementsService } from './achievements.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health Score')
@Controller('health-score')
@UseGuards(JwtAuthGuard)
export class HealthScoreController {
  constructor(
    private readonly healthService: HealthScoreService,
    private readonly achievementsService: AchievementsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current user health score' })
  async getHealthScore(@Request() req) {
    return this.healthService.getHealthScore(req.user.id);
  }

  @Get('/achievements')
  @ApiOperation({ summary: 'Get user achievements' })
  async getAchievements(@Request() req) {
    return this.achievementsService.getUserAchievements(req.user.id);
  }

  @Post('/refresh-insights')
  @ApiOperation({ summary: 'Force refresh of AI insights' })
  async refreshInsights(@Request() req) {
    return this.healthService.refreshAiInsights(req.user.id);
  }
}
