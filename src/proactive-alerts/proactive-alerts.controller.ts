import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ProactiveAlertsService } from './proactive-alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service'; // Direct prisma usage for simple CRUD or inject Service method

@ApiTags('Alertas Proativos')
@Controller('proactive-alerts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProactiveAlertsController {
  constructor(
      private readonly service: ProactiveAlertsService,
      private readonly prisma: PrismaService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar alertas ativos' })
  async findAll(@CurrentUser() user) {
      return this.prisma.proactiveAlert.findMany({
          where: { userId: user.id, dismissed: false },
          orderBy: { createdAt: 'desc' }
      });
  }

  @Post(':id/dismiss')
  @ApiOperation({ summary: 'Marcar alerta como dispensado' })
  async dismiss(@CurrentUser() user, @Param('id') id: string) {
      return this.prisma.proactiveAlert.update({
          where: { id, userId: user.id },
          data: { dismissed: true }
      });
  }

  @Post('run-checks')
  @ApiOperation({ summary: 'Executar verificações manualmente (Dev/Debug)' })
  async runChecks() {
       await this.service.runDailyChecks();
       return { message: 'Checks executed' };
  }
}
