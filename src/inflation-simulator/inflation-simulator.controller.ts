import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { InflationSimulatorService } from './inflation-simulator.service';
import { InflationSimulationDto } from './dto/inflation-simulation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Simulador de Inflação')
@Controller('simulations/inflation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InflationSimulatorController {
  constructor(private readonly service: InflationSimulatorService) {}

  @Post('impact')
  @ApiOperation({ summary: 'Projetar impacto da inflação e ajustes' })
  simulate(@CurrentUser() user, @Body() dto: InflationSimulationDto) {
    return this.service.simulate(user.id, dto);
  }

  @Get('scenarios')
  @ApiOperation({ summary: 'Listar cenários pré-definidos' })
  getScenarios() {
    return this.service.getScenarios();
  }
}
