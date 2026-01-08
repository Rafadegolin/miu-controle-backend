import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectionsService } from './projections.service';
import { CashFlowProjectionQueryDto } from './dto/cash-flow-projection-query.dto';
import { CashFlowProjectionResponseDto } from './dto/cash-flow-projection-response.dto';

@Controller('projections')
@UseGuards(JwtAuthGuard)
export class ProjectionsController {
  constructor(private readonly projectionsService: ProjectionsService) {}

  @Get('cash-flow')
  async getCashFlow(
    @Req() req,
    @Query() query: CashFlowProjectionQueryDto
  ): Promise<CashFlowProjectionResponseDto> {
    return this.projectionsService.calculateCashFlow(req.user.id, query);
  }

  @Get('balance-forecast')
  async getBalanceForecast(
    @Req() req,
    @Query('months') months?: string
  ) {
    // Simplified endpoint for just final balance
    const result = await this.projectionsService.calculateCashFlow(req.user.id, { 
      months: months ? parseInt(months) : 1 
    });
    const lastMonth = result.data[result.data.length - 1];
    return {
        forecastDate: lastMonth.month,
        predictedBalance: lastMonth.balance.accumulated
    };
  }
}
