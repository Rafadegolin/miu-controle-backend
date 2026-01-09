import { Controller, Get, Post, Body, UseGuards, Patch } from '@nestjs/common';
import { EmergencyFundService } from './emergency-fund.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Colchão Financeiro')
@Controller('emergency-fund')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EmergencyFundController {
  constructor(private readonly service: EmergencyFundService) {}

  @Post('setup')
  @ApiOperation({ summary: 'Inicializar colchão financeiro' })
  setup(@CurrentUser() user) {
    return this.service.setup(user.id);
  }

  @Get('status')
  @ApiOperation({ summary: 'Ver status do colchão' })
  getStatus(@CurrentUser() user) {
    return this.service.getStatus(user.id);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Realizar saque de emergência' })
  withdraw(
      @CurrentUser() user,
      @Body() body: { amount: number; reason: string }
  ) {
    return this.service.withdraw(user.id, body.amount, body.reason);
  }

  @Post('contribute')
  @ApiOperation({ summary: 'Adicionar valor ao colchão' })
  contribute(
      @CurrentUser() user,
      @Body() body: { amount: number }
  ) {
      return this.service.contribute(user.id, body.amount);
  }

  @Patch('update')
  @ApiOperation({ summary: 'Atualizar meta do colchão' })
  update(
      @CurrentUser() user,
      @Body() body: { targetAmount?: number; linkedGoalId?: string }
  ) {
      return this.service.updateSettings(user.id, body);
  }

  @Get('history')
  @ApiOperation({ summary: 'Ver histórico de saques' })
  getHistory(@CurrentUser() user) {
    return this.service.getHistory(user.id);
  }
}
