import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Relatórios Avançados')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard com KPIs principais' })
  @ApiResponse({ status: 200, description: 'Dashboard gerado' })
  getDashboard(@CurrentUser() user: any, @Query() filters: ReportFiltersDto) {
    return this.reportsService.getDashboard(user.id, filters);
  }

  @Get('category-analysis')
  @ApiOperation({ summary: 'Análise detalhada por categorias' })
  @ApiResponse({ status: 200, description: 'Análise por categorias' })
  getCategoryAnalysis(
    @CurrentUser() user: any,
    @Query() filters: ReportFiltersDto,
  ) {
    return this.reportsService.getCategoryAnalysis(user.id, filters);
  }

  @Get('monthly-trend')
  @ApiOperation({ summary: 'Tendência mensal (gráfico de linha)' })
  @ApiResponse({ status: 200, description: 'Dados mensais' })
  getMonthlyTrend(
    @CurrentUser() user: any,
    @Query() filters: ReportFiltersDto,
  ) {
    return this.reportsService.getMonthlyTrend(user.id, filters);
  }

  @Get('account-analysis')
  @ApiOperation({ summary: 'Análise por conta bancária' })
  @ApiResponse({ status: 200, description: 'Análise por contas' })
  getAccountAnalysis(
    @CurrentUser() user: any,
    @Query() filters: ReportFiltersDto,
  ) {
    return this.reportsService.getAccountAnalysis(user.id, filters);
  }

  @Get('top-transactions')
  @ApiOperation({ summary: 'Top 10 maiores receitas e despesas' })
  @ApiResponse({ status: 200, description: 'Top transações' })
  getTopTransactions(
    @CurrentUser() user: any,
    @Query() filters: ReportFiltersDto,
  ) {
    return this.reportsService.getTopTransactions(user.id, filters);
  }

  @Get('insights')
  @ApiOperation({ summary: 'Insights e análises automáticas' })
  @ApiResponse({ status: 200, description: 'Insights gerados' })
  getInsights(@CurrentUser() user: any, @Query() filters: ReportFiltersDto) {
    return this.reportsService.getInsights(user.id, filters);
  }

  @Get('full-report')
  @ApiOperation({ summary: 'Relatório completo com todos os dados' })
  @ApiResponse({ status: 200, description: 'Relatório completo gerado' })
  getFullReport(@CurrentUser() user: any, @Query() filters: ReportFiltersDto) {
    return this.reportsService.getFullReport(user.id, filters);
  }
}
