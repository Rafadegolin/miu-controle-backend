import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { ContributeGoalDto } from './dto/contribute-goal.dto';
import { AddPurchaseLinkDto } from './dto/add-purchase-link.dto';
import { UpdatePurchaseLinkDto } from './dto/update-purchase-link.dto';
import { GoalStatus, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { v4 as uuidv4 } from 'uuid';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheService } from '../common/services/cache.service';

export interface PurchaseLink {
  id: string;
  title: string;
  url: string;
  price?: number;
  currency?: string;
  note?: string;
  addedAt: string;
  updatedAt?: string;
}

@Injectable()
export class GoalsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private cacheService: CacheService,
  ) {}

  async getHierarchy(userId: string) {
    // Busca apenas objetivos RAIZ (nível 0 ou sem pai) e traz filhos recursivamente
    // Prisma não tem suporte nativo a recursão infinita no 'include', então vamos pegar até nivel 4 manualmente
    const includeLevel = {
        children: {
            include: {
                children: {
                    include: {
                        children: true // Nível 3 (pai=0, filho=1, neto=2, bisneto=3)
                    }
                }
            }
        }
    };

    return this.prisma.goal.findMany({
        where: { userId, parentId: null },
        include: includeLevel,
        orderBy: { priority: 'desc' }
    });
  }

  async create(userId: string, createGoalDto: any) { // Using any for extended DTO (custom)
    const targetDate = createGoalDto.targetDate
      ? new Date(createGoalDto.targetDate)
      : null;

    // Validar data no futuro
    if (targetDate && targetDate < new Date()) {
      throw new BadRequestException('Data objetivo deve ser no futuro');
    }

    // Validar Hierarquia (Maximum Depth 4)
    let hierarchyLevel = 0;
    if (createGoalDto.parentId) {
        const parent = await this.prisma.goal.findUnique({ where: { id: createGoalDto.parentId } });
        if (!parent) throw new BadRequestException('Objetivo pai não encontrado');
        if (parent.userId !== userId) throw new ForbiddenException('Acesso negado ao objetivo pai');
        
        hierarchyLevel = parent.hierarchyLevel + 1;
        if (hierarchyLevel > 3) throw new BadRequestException('Profundidade máxima atingida (4 níveis)');
    }

    return this.prisma.goal.create({
      data: {
        userId,
        name: createGoalDto.name,
        description: createGoalDto.description,
        targetAmount: createGoalDto.targetAmount,
        targetDate,
        color: createGoalDto.color || '#10B981',
        icon: createGoalDto.icon,
        priority: createGoalDto.priority || 3,
        status: 'ACTIVE',
        currentAmount: 0,
        // New Fields
        parentId: createGoalDto.parentId,
        hierarchyLevel,
        distributionStrategy: createGoalDto.distributionStrategy
      },
    });
  }

  async findAll(userId: string, status?: GoalStatus) {
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    const goals = await this.prisma.goal.findMany({
      where,
      include: {
        _count: {
          select: { contributions: true },
        },
      },
      orderBy: [
        { priority: 'asc' },
        { targetDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return goals.map((goal) => ({
      ...goal,
      percentage: this.calculatePercentage(
        goal.currentAmount,
        goal.targetAmount,
      ),
      remaining: Number(goal.targetAmount) - Number(goal.currentAmount),
      isOverdue: goal.targetDate
        ? new Date(goal.targetDate) < new Date()
        : false,
      daysRemaining: goal.targetDate
        ? this.calculateDaysRemaining(goal.targetDate)
        : null,
    }));
  }

  async findOne(id: string, userId: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
      include: {
        contributions: {
          include: {
            transaction: {
              select: {
                id: true,
                description: true,
                date: true,
              },
            },
          },
          orderBy: {
            date: 'desc',
          },
        },
        _count: {
          select: { contributions: true },
        },
      },
    });

    if (!goal) {
      throw new NotFoundException('Objetivo não encontrado');
    }

    if (goal.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar este objetivo',
      );
    }

    return {
      ...goal,
      percentage: this.calculatePercentage(
        goal.currentAmount,
        goal.targetAmount,
      ),
      remaining: Number(goal.targetAmount) - Number(goal.currentAmount),
      isOverdue: goal.targetDate
        ? new Date(goal.targetDate) < new Date()
        : false,
      daysRemaining: goal.targetDate
        ? this.calculateDaysRemaining(goal.targetDate)
        : null,
    };
  }

  async update(id: string, userId: string, updateGoalDto: UpdateGoalDto) {
    const goal = await this.findOne(id, userId);

    // Validar data se mudando
    if (updateGoalDto.targetDate) {
      const newTargetDate = new Date(updateGoalDto.targetDate);
      if (newTargetDate < new Date()) {
        throw new BadRequestException('Data objetivo deve ser no futuro');
      }
    }

    // Se marcando como completado, atualizar data
    const updateData: any = { ...updateGoalDto };

    if (updateGoalDto.status === 'COMPLETED' && goal.status !== 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    if (updateGoalDto.targetDate) {
      updateData.targetDate = new Date(updateGoalDto.targetDate);
    }

    return this.prisma.goal.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    // Verificar se tem contribuições
    const contributionsCount = await this.prisma.goalContribution.count({
      where: { goalId: id },
    });

    if (contributionsCount > 0) {
      throw new BadRequestException(
        `Este objetivo tem ${contributionsCount} contribuição(ões). Cancele o objetivo ao invés de deletá-lo.`,
      );
    }

    await this.prisma.goal.delete({ where: { id } });

    return { message: 'Objetivo deletado com sucesso' };
  }

  async contribute(
    id: string,
    userId: string,
    contributeDto: ContributeGoalDto,
  ) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
      include: { children: true }
    });
    
    if (!goal) throw new NotFoundException('Objetivo não encontrado');
    if (goal.userId !== userId) throw new ForbiddenException('Sem permissão');
    if (goal.status !== 'ACTIVE') throw new BadRequestException('Só é possível contribuir para objetivos ativos');

    // Validar transação se fornecida
    if (contributeDto.transactionId) {
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: contributeDto.transactionId },
      });
      if (!transaction || transaction.userId !== userId) throw new NotFoundException('Transação não encontrada');
    }

    const date = contributeDto.date ? new Date(contributeDto.date) : new Date();

    // LÓGICA DE DISTRIBUIÇÃO (Issue #65)
    // Se tiver filhos, distribuir
    if (goal.children.length > 0) {
        if (goal.distributionStrategy === 'PROPORTIONAL') {
            await this.distributeProportional(goal, contributeDto.amount, userId);
        } else if (goal.distributionStrategy === 'SEQUENTIAL') {
            await this.distributeSequential(goal, contributeDto.amount, userId);
        } else {
            // Default or Manual (se manual, apenas joga no pai por enquanto ou exige endpoint especifico, vamos assumir proporcional como fallback)
            await this.distributeProportional(goal, contributeDto.amount, userId);
        }
        // Recalcula o pai
        await this.updateAggregatedProgress(goal.id);
        
        // Retorna estado atualizado
        return this.findOne(id, userId);
    } 
    
    // Se for folha, comportamento normal
    return this.addContribution(id, contributeDto.amount, userId, contributeDto.transactionId, date);
  }

  // --- HIERARCHY HELPERS (Issue #65) ---

  private async addContribution(goalId: string, amount: number, userId: string, transactionId?: string, date = new Date()) {
      const contribution = await this.prisma.goalContribution.create({
          data: { goalId, transactionId, amount, date }
      });
      
      const goal = await this.prisma.goal.findUnique({ where: { id: goalId } });
      const newAmount = Number(goal.currentAmount) + amount;
      
      let updateData: any = { currentAmount: newAmount };
      if (newAmount >= Number(goal.targetAmount) && goal.status === 'ACTIVE') {
          updateData.status = 'COMPLETED';
          updateData.completedAt = new Date();
          // Notificar
          try { await this.notificationsService.checkGoalAchieved(goalId); } catch(e) {}
      }

      await this.prisma.goal.update({ where: { id: goalId }, data: updateData });

      return { contribution, goal: { ...goal, ...updateData } };
  }

  private async distributeProportional(parent: any, amount: number, userId: string) {
      const totalTarget = parent.children.reduce((sum, child) => sum + Number(child.targetAmount), 0);
      
      if (totalTarget === 0) {
          const share = amount / parent.children.length;
          for (const child of parent.children) await this.addContribution(child.id, share, userId);
          return;
      }

      for (const child of parent.children) {
          const weight = Number(child.targetAmount) / totalTarget;
          const share = amount * weight;
          await this.addContribution(child.id, share, userId);
      }
  }

  private async distributeSequential(parent: any, amount: number, userId: string) {
      const sortedChildren = parent.children.sort((a,b) => b.priority - a.priority);
      
      let remaining = amount;
      for (const child of sortedChildren) {
          if (remaining <= 0) break;
          const missing = Number(child.targetAmount) - Number(child.currentAmount);
          if (missing <= 0) continue; 

          const toAdd = Math.min(remaining, missing);
          await this.addContribution(child.id, toAdd, userId);
          remaining -= toAdd;
      }
  }

  private async updateAggregatedProgress(parentId: string) {
      const parent = await this.prisma.goal.findUnique({ where: { id: parentId }, include: { children: true } });
      if(!parent) return;

      const totalCurrent = parent.children.reduce((sum, child) => sum + Number(child.currentAmount), 0);
      await this.prisma.goal.update({
          where: { id: parentId },
          data: { currentAmount: totalCurrent }
      });
      
      if (parent.parentId) await this.updateAggregatedProgress(parent.parentId);
  }

  async withdraw(id: string, userId: string, amount: number) {
    const goal = await this.findOne(id, userId);

    if (Number(goal.currentAmount) < amount) {
      throw new BadRequestException(
        'Valor de retirada maior que saldo disponível',
      );
    }

    // Criar contribuição negativa
    const contribution = await this.prisma.goalContribution.create({
      data: {
        goalId: id,
        amount: -amount,
        date: new Date(),
      },
    });

    // Atualizar valor atual
    const newCurrentAmount = Number(goal.currentAmount) - amount;

    const updatedGoal = await this.prisma.goal.update({
      where: { id },
      data: {
        currentAmount: newCurrentAmount,
        // Se estava completo e retirou, voltar para ativo
        ...(goal.status === 'COMPLETED' && {
          status: 'ACTIVE',
          completedAt: null,
        }),
      },
    });

    return {
      contribution,
      goal: {
        ...updatedGoal,
        percentage: this.calculatePercentage(
          updatedGoal.currentAmount,
          updatedGoal.targetAmount,
        ),
        remaining:
          Number(updatedGoal.targetAmount) - Number(updatedGoal.currentAmount),
      },
    };
  }

  /**
   * Resumo de objetivos do usuário
   * Cache: 10 minutos
   */
  async getSummary(userId: string) {
    const cacheKey = `goals:${userId}:summary`;

    // Tentar buscar do cache
    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        this.cacheService.logHit(cacheKey);
        return cached as any;
      }
    } catch (error) {
      // Se cache falhar, continua
    }

    this.cacheService.logMiss(cacheKey);
    const goals = await this.prisma.goal.findMany({
      where: { userId },
    });

    const active = goals.filter((g) => g.status === 'ACTIVE');
    const completed = goals.filter((g) => g.status === 'COMPLETED');
    const cancelled = goals.filter((g) => g.status === 'CANCELLED');

    const totalTargeted = active.reduce(
      (sum, g) => sum + Number(g.targetAmount),
      0,
    );
    const totalSaved = active.reduce(
      (sum, g) => sum + Number(g.currentAmount),
      0,
    );

    const result = {
      total: goals.length,
      active: active.length,
      completed: completed.length,
      cancelled: cancelled.length,
      totalTargeted,
      totalSaved,
      totalRemaining: totalTargeted - totalSaved,
      overallProgress: totalTargeted > 0 ? (totalSaved / totalTargeted) * 100 : 0,
      goals: goals.map((goal) => ({
        id: goal.id,
        name: goal.name,
        status: goal.status,
        percentage: this.calculatePercentage(
          goal.currentAmount,
          goal.targetAmount,
        ),
        currentAmount: Number(goal.currentAmount),
        targetAmount: Number(goal.targetAmount),
        color: goal.color,
        icon: goal.icon,
      })),
    };

    // Salvar no cache por 10 minutos (600000ms)
    try {
      await this.cacheManager.set(cacheKey, result, 600000);
    } catch (error) {
      // Se falhar ao salvar cache, apenas continue
    }

    return result;
  }

  // ==================== MÉTODOS AUXILIARES ====================

  private calculatePercentage(current: any, target: any): number {
    const currentNum = Number(current);
    const targetNum = Number(target);
    if (targetNum === 0) return 0;
    return Math.round((currentNum / targetNum) * 100 * 100) / 100;
  }

  private calculateDaysRemaining(targetDate: Date): number {
    const now = new Date();
    const diff = new Date(targetDate).getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // ==================== GERENCIAMENTO DE IMAGEM ====================

  /**
   * Atualizar informações da imagem da meta
   */
  async updateImage(
    goalId: string,
    data: {
      imageUrl: string | null;
      imageKey: string | null;
      imageMimeType?: string | null;
      imageSize?: number | null;
    },
  ) {
    return this.prisma.goal.update({
      where: { id: goalId },
      data,
    });
  }

  // ==================== GERENCIAMENTO DE LINKS ====================

  /**
   * Adicionar link de compra
   */
  async addPurchaseLink(
    goalId: string,
    userId: string,
    dto: AddPurchaseLinkDto,
  ) {
    const goal = await this.findOne(goalId, userId);

    const currentLinks = Array.isArray(goal.purchaseLinks)
      ? (goal.purchaseLinks as unknown as PurchaseLink[])
      : [];

    // Validar máximo de links (10 por meta)
    if (currentLinks.length >= 10) {
      throw new BadRequestException('Máximo de 10 links por meta');
    }

    const newLink: PurchaseLink = {
      id: uuidv4(),
      title: dto.title,
      url: dto.url,
      price: dto.price,
      currency: dto.currency || 'BRL',
      note: dto.note,
      addedAt: new Date().toISOString(),
    };

    const updatedLinks = [...currentLinks, newLink];

    return this.prisma.goal.update({
      where: { id: goalId },
      data: {
        purchaseLinks: updatedLinks as unknown as Prisma.InputJsonValue,
      },
      include: {
        _count: {
          select: { contributions: true },
        },
      },
    });
  }

  /**
   * Atualizar link de compra
   */
  async updatePurchaseLink(
    goalId: string,
    linkId: string,
    userId: string,
    dto: UpdatePurchaseLinkDto,
  ) {
    const goal = await this.findOne(goalId, userId);

    const currentLinks = Array.isArray(goal.purchaseLinks)
      ? (goal.purchaseLinks as unknown as PurchaseLink[])
      : [];
    const linkIndex = currentLinks.findIndex((link) => link.id === linkId);

    if (linkIndex === -1) {
      throw new NotFoundException('Link não encontrado');
    }

    currentLinks[linkIndex] = {
      ...currentLinks[linkIndex],
      ...dto,
      updatedAt: new Date().toISOString(),
    };

    return this.prisma.goal.update({
      where: { id: goalId },
      data: {
        purchaseLinks: currentLinks as unknown as Prisma.InputJsonValue,
      },
      include: {
        _count: {
          select: { contributions: true },
        },
      },
    });
  }

  /**
   * Deletar link de compra
   */
  async deletePurchaseLink(goalId: string, linkId: string, userId: string) {
    const goal = await this.findOne(goalId, userId);

    const currentLinks = Array.isArray(goal.purchaseLinks)
      ? (goal.purchaseLinks as unknown as PurchaseLink[])
      : [];
    const updatedLinks = currentLinks.filter((link) => link.id !== linkId);

    if (currentLinks.length === updatedLinks.length) {
      throw new NotFoundException('Link não encontrado');
    }

    return this.prisma.goal.update({
      where: { id: goalId },
      data: {
        purchaseLinks: updatedLinks as unknown as Prisma.InputJsonValue,
      },
      include: {
        _count: {
          select: { contributions: true },
        },
      },
    });
  }

  /**
   * Calcular total de preços dos links
   */
  async getTotalPurchaseLinksPrice(
    goalId: string,
    userId: string,
  ): Promise<{
    total: number;
    totalBRL: number;
    byCurrenty: Record<string, number>;
    links: PurchaseLink[];
  }> {
    const goal = await this.findOne(goalId, userId);
    const links = Array.isArray(goal.purchaseLinks)
      ? (goal.purchaseLinks as unknown as PurchaseLink[])
      : [];

    const byCurrency: Record<string, number> = {};
    let totalBRL = 0;

    links.forEach((link) => {
      if (link.price) {
        const currency = link.currency || 'BRL';
        byCurrency[currency] = (byCurrency[currency] || 0) + link.price;

        // Para MVP, assumir BRL (depois integrar com exchange rates)
        if (currency === 'BRL') {
          totalBRL += link.price;
        }
      }
    });

    return {
      total: links.length,
      totalBRL,
      byCurrenty: byCurrency,
      links,
    };
  }
}
