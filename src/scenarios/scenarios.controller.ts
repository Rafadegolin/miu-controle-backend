import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ScenariosService } from './scenarios.service';
import { SimulateScenarioDto } from './dto/simulate-scenario.dto';
import { AffordabilityCheckDto } from './dto/affordability-check.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Simulador E Se')
@Controller('scenarios')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ScenariosController {
  constructor(private readonly service: ScenariosService) {}

  @Post('simulate')
  @ApiOperation({ summary: 'Simular um cenário financeiro' })
  simulate(@CurrentUser() user, @Body() dto: SimulateScenarioDto) {
    return this.service.simulate(user.id, dto);
  }

  @Post('affordability')
  @ApiOperation({ summary: 'Verificar viabilidade de uma compra' })
  checkAffordability(@CurrentUser() user, @Body() dto: AffordabilityCheckDto) {
    return this.service.checkAffordability(user.id, dto);
  }

  @Post('compare')
  @ApiOperation({ summary: 'Comparar múltiplos cenários' })
  compare(@CurrentUser() user, @Body() dtos: SimulateScenarioDto[]) {
    // Placeholder for comparison logic
    return []; 
  }
}
