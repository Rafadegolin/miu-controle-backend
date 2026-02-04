import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from './metrics.service';

@ApiTags('Health')
@Controller('health')
@SkipThrottle() // Todos os endpoints de health sem rate limit
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaService,
    private metrics: MetricsService,
  ) {}

  /**
   * Health check completo
   * Verifica: DB, Memory, Disk
   */
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check completo',
    description: 'Verifica status de todos os componentes (DB, Memory, Disk)',
  })
  @ApiResponse({
    status: 200,
    description: 'Sistema saudável',
    schema: {
      example: {
        status: 'ok',
        info: {
          database: { status: 'up' },
          memory_heap: { status: 'up' },
          storage: { status: 'up' },
        },
      },
    },
  })
  check() {
    return this.health.check([
      // Database (Prisma)
      () => this.prismaHealth.pingCheck('database', this.prisma),

      // Memory (heap não deve exceder 512MB)
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),

      // Disk (deve ter pelo menos 10% livre)
      // Usa C:\ no Windows ou / no Linux/Mac
      () =>
        this.disk.checkStorage('storage', {
          path: process.platform === 'win32' ? 'C:\\' : '/',
          thresholdPercent: 0.9, // 90% threshold
        }),
    ]);
  }

  /**
   * Kubernetes Liveness Probe
   * Retorna ok se o processo está rodando
   */
  @Get('live')
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness probe (Kubernetes)',
    description: 'Verifica se a aplicação está viva. Falha = restart pod.',
  })
  checkLive(): Promise<HealthCheckResult> {
    // Simples: apenas retorna ok se processo está rodando
    return this.health.check([]);
  }

  /**
   * Kubernetes Readiness Probe
   * Retorna ok se a aplicação está pronta para receber tráfego
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe (Kubernetes)',
    description:
      'Verifica se a aplicação está pronta para receber tráfego. Falha = remove do load balancer.',
  })
  checkReady() {
    return this.health.check([
      // Só aceita tráfego se DB estiver OK
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]);
  }

  /**
   * Métricas da aplicação
   * Retorna estatísticas e métricas para monitoramento
   */
  @Get('metrics')
  @ApiOperation({
    summary: 'Métricas da aplicação',
    description:
      'Estatísticas e métricas para monitoramento (usuários, transações, performance)',
  })
  @ApiResponse({
    status: 200,
    description: 'Métricas coletadas',
    schema: {
      example: {
        application: {
          name: 'Miu Controle API',
          version: '1.0.0',
          uptime: 12345,
          environment: 'production',
        },
        database: {
          totalUsers: 150,
          totalTransactions: 5420,
          todayTransactions: 25,
        },
        performance: {
          totalRequests: 10523,
          averageLatency: 45,
        },
      },
    },
  })
  async getMetrics() {
    return this.metrics.getMetrics();
  }
}
