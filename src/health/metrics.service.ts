import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Serviço para coletar métricas da aplicação
 * 
 * Coleta:
 * - Total de usuários
 * - Total de transações
 * - Transações criadas hoje
 * - Contadores de requisições
 * - Latência média
 */
@Injectable()
export class MetricsService {
  private requestCount = 0;
  private requestTimes: number[] = [];
  private readonly MAX_SAMPLES = 1000; // Armazena últimas 1000 latências

  constructor(private prisma: PrismaService) {}

  /**
   * Incrementa contador de requisições
   */
  incrementRequests() {
    this.requestCount++;
  }

  /**
   * Adiciona tempo de requisição para cálculo de latência média
   */
  addRequestTime(ms: number) {
    this.requestTimes.push(ms);
    if (this.requestTimes.length > this.MAX_SAMPLES) {
      this.requestTimes.shift(); // Remove mais antigo
    }
  }

  /**
   * Coleta métricas gerais da aplicação
   */
  async getMetrics() {
    const [users, transactions, todayTransactions] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.transaction.count(),
      this.prisma.transaction.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    const avgLatency = this.requestTimes.length > 0
      ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length
      : 0;

    return {
      application: {
        name: 'Miu Controle API',
        version: '1.0.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      },
      database: {
        totalUsers: users,
        totalTransactions: transactions,
        todayTransactions,
      },
      performance: {
        totalRequests: this.requestCount,
        averageLatency: Math.round(avgLatency),
        memoryUsage: process.memoryUsage(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
