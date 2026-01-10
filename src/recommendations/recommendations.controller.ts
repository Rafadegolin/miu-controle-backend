import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Recommendations')
@Controller('recommendations')
@UseGuards(JwtAuthGuard)
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get active recommendations' })
  async findAll(@Request() req) {
    return this.recommendationsService.findAll(req.user.id);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Force generate recommendations (Testing)' })
  async generate(@Request() req) {
    await this.recommendationsService.generateRecommendationsForUser(req.user.id);
    return this.recommendationsService.findAll(req.user.id);
  }

  @Post(':id/apply')
  @ApiOperation({ summary: 'Apply a recommendation' })
  async apply(@Request() req, @Param('id') id: string) {
    return this.recommendationsService.applyRecommendation(req.user.id, id);
  }

  @Post(':id/dismiss')
  @ApiOperation({ summary: 'Dismiss a recommendation' })
  async dismiss(@Request() req, @Param('id') id: string) {
    return this.recommendationsService.dismissRecommendation(req.user.id, id);
  }
}
