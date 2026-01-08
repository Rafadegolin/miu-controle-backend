import { Controller, Get, Post, Query, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalysisService } from './analysis.service';

@Controller('analysis')
@UseGuards(JwtAuthGuard)
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Get('monthly-comparison')
  async getMonthlyComparison(
    @Req() req,
    @Query('month') monthStr: string // YYYY-MM
  ) {
    const date = monthStr ? new Date(`${monthStr}-01`) : new Date();
    // Try to find existing report or Generate on fly?
    // Good practice: If requesting current month (not closed), forecast/partial.
    // If past month, find or generate.
    
    // For now, always generate/upsert ensures latest data
    return this.analysisService.generateMonthlyReport(req.user.id, date);
  }

  @Get('latest')
  async getLatest(@Req() req) {
      return this.analysisService.getLatestReport(req.user.id);
  }
}
