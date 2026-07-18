import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Invalidar cache completo do usuário (relatórios, budgets, goals, dashboard)
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const keys = [
      `reports:${userId}:dashboard`,
      `reports:${userId}:category`,
      `reports:${userId}:monthly`,
      `reports:${userId}:account`,
      `reports:${userId}:top`,
      `budgets:${userId}:summary`,
      `goals:${userId}:summary`,
    ];

    await Promise.all(keys.map((pattern) => this.deleteByPattern(pattern)));
    this.logger.log(`🗑️  Cache invalidado para usuário ${userId}`);
  }

  /**
   * Invalidar cache de contas
   */
  async invalidateAccountCache(
    userId: string,
    accountId?: string,
  ): Promise<void> {
    await this.cacheManager.del(`reports:${userId}:account`);
    await this.invalidateUserCache(userId);
    this.logger.log(`🗑️  Cache de contas invalidado para usuário ${userId}`);
  }

  /**
   * Invalidar cache de orçamento
   */
  async invalidateBudgetCache(
    userId: string,
    budgetId?: string,
  ): Promise<void> {
    await this.cacheManager.del(`budgets:${userId}:summary`);
    this.logger.log(`🗑️  Cache de budgets invalidado para usuário ${userId}`);
  }

  /**
   * Invalidar cache de metas
   */
  async invalidateGoalCache(userId: string, goalId?: string): Promise<void> {
    await this.cacheManager.del(`goals:${userId}:summary`);
    this.logger.log(`🗑️  Cache de goals invalidado para usuário ${userId}`);
  }

  /**
   * Helper para deletar por padrão (usando wildcard)
   */
  private async deleteByPattern(pattern: string): Promise<void> {
    try {
      // Com cache-manager v5, acessamos via store getter
      const store: any = (this.cacheManager as any).store;
      if (!store?.client) return;

      const keys = await store.client.keys(`${pattern}*`);
      if (keys.length > 0) {
        await Promise.all(
          keys.map((key: string) => this.cacheManager.del(key)),
        );
        this.logger.debug(`Deletadas ${keys.length} chaves: ${pattern}*`);
      }
    } catch (error) {
      this.logger.error(`Erro ao deletar pattern ${pattern}:`, error.message);
    }
  }

  /**
   * Logging de cache hits
   */
  logHit(key: string): void {
    this.cacheHits++;
    this.logger.debug(`✅ Cache HIT: ${key}`);
  }

  /**
   * Logging de cache misses
   */
  logMiss(key: string): void {
    this.cacheMisses++;
    this.logger.debug(`❌ Cache MISS: ${key}`);
  }

  /**
   * Estatísticas de cache
   */
  getStats() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total) * 100 : 0;

    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      total,
      hitRate: Math.round(hitRate * 100) / 100,
    };
  }

  /**
   * Reset de estatísticas
   */
  resetStats(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.logger.log('📊 Estatísticas de cache resetadas');
  }

  /**
   * Obter instância do cache manager para uso direto
   */
  getCacheManager(): Cache {
    return this.cacheManager;
  }
}
