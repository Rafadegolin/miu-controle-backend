import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/services/cache.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  @Get('cache-stats')
  @ApiOperation({ summary: 'Obter estatísticas do cache Redis' })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas do cache retornadas com sucesso',
    schema: {
      example: {
        cacheHits: 1250,
        cacheMisses: 180,
        hitRate: 87.41,
        timestamp: '2025-12-29T14:00:00.000Z',
      },
    },
  })
  getCacheStats() {
    return {
      ...this.cacheService.getStats(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('cache-reset')
  @ApiOperation({ summary: 'Resetar estatísticas do cache' })
  @ApiResponse({
    status: 200,
    description: 'Estatísticas resetadas com sucesso',
    schema: {
      example: {
        message: 'Cache statistics reset successfully',
        timestamp: '2025-12-29T14:00:00.000Z',
      },
    },
  })
  resetCacheStats() {
    this.cacheService.resetStats();
    return {
      message: 'Cache statistics reset successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('slow-queries')
  @ApiOperation({
    summary: 'Listar queries lentas para monitoramento',
    description:
      'Retorna as últimas 100 queries que demoraram mais de 200ms. Endpoint para administradores.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de queries lentas',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          query: { type: 'string', example: 'Transaction.findMany' },
          params: { type: 'string', example: '{"where":{"userId":"123"}}' },
          duration: { type: 'number', example: 345 },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  getSlowQueries() {
    return this.prisma.getSlowQueries();
  }

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Obter estatísticas gerais do sistema' })
  async getDashboardStats() {
    const [totalUsers, activeUsers, totalSubscriptions, totalTransactions] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.userSubscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.transaction.count()
    ]);

    return {
       users: { total: totalUsers, active: activeUsers },
       subscriptions: { active: totalSubscriptions },
       system: { transactions: totalTransactions, health: 'OK' }
    };
  }

}
