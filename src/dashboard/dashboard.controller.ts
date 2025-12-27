import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('home')
  @ApiOperation({
    summary: 'Dashboard completo para tela inicial',
    description:
      'Retorna um resumo completo com saldo de contas, transações do mês, metas, orçamentos, transações recorrentes, notificações e insights inteligentes',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard gerado com sucesso',
    type: DashboardResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Não autorizado - Token inválido ou ausente',
  })
  async getHomeDashboard(
    @CurrentUser() user: any,
  ): Promise<DashboardResponseDto> {
    return this.dashboardService.getHomeDashboard(user.id);
  }
}
