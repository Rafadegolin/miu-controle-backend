import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AffordabilityService } from './affordability.service';
import { AffordabilityCheckDto } from './dto/affordability-check.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Análise de Viabilidade')
@Controller('affordability')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AffordabilityController {
  constructor(private readonly service: AffordabilityService) {}

  @Post('check')
  @ApiOperation({ summary: 'Verificar viabilidade de uma compra' })
  check(@CurrentUser() user, @Body() dto: AffordabilityCheckDto) {
    return this.service.check(user.id, dto);
  }
}
