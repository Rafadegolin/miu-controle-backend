import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { PlanningService } from './planning.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Planejamento Inteligente')
@Controller('planning')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Get('goal/:goalId/calculate')
  @ApiOperation({ summary: 'Simular plano para atingir meta' })
  calculatePlan(@Param('goalId') goalId: string, @CurrentUser() user) {
    return this.planningService.calculateGoalPlan(user.id, goalId);
  }

  @Post('goal/:goalId/save')
  @ApiOperation({ summary: 'Salvar plano aprovado' })
  savePlan(
      @Param('goalId') goalId: string, 
      @CurrentUser() user,
      @Body() planData: any 
  ) {
    return this.planningService.savePlan(user.id, goalId, planData);
  }
}
