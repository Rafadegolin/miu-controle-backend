import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export interface SlowQuery {
  query: string;
  params: string;
  duration: number;
  timestamp: Date;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private slowQueries: SlowQuery[] = [];
  private readonly SLOW_QUERY_THRESHOLD = 200; // ms
  private readonly MAX_SLOW_QUERIES = 100;

  async onModuleInit() {
    await this.$connect();
    
    // Middleware para logging de queries lentas
    this.$use(async (params, next) => {
      const before = Date.now();
      const result = await next(params);
      const after = Date.now();
      const duration = after - before;

      // Log queries lentas (>200ms)
      if (duration > this.SLOW_QUERY_THRESHOLD) {
        const queryInfo: SlowQuery = {
          query: `${params.model}.${params.action}`,
          params: JSON.stringify(params.args),
          duration,
          timestamp: new Date(),
        };

        this.logger.warn(
          `🐌 Slow Query Detected: ${queryInfo.query} took ${duration}ms`,
        );

        // Adicionar ao cache de slow queries (máximo 100)
        this.slowQueries.unshift(queryInfo);
        if (this.slowQueries.length > this.MAX_SLOW_QUERIES) {
          this.slowQueries.pop();
        }
      }

      return result;
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Health check: verifica se DB está respondendo
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retorna slow queries registradas para monitoramento
   */
  getSlowQueries(): SlowQuery[] {
    return this.slowQueries;
  }
}
