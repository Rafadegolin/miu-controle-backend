import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { ContributeGoalDto } from './dto/contribute-goal.dto';
import { GoalStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class GoalsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(userId: string, createGoalDto: CreateGoalDto) {
    const targetDate = createGoalDto.targetDate
      ? new Date(createGoalDto.targetDate)
      : null;

    // Validar data no futuro
    if (targetDate && targetDate < new Date()) {
      throw new BadRequestException('Data objetivo deve ser no futuro');
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
    const goal = await this.findOne(id, userId);

    if (goal.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Só é possível contribuir para objetivos ativos',
      );
    }

    // Validar transação se fornecida
    if (contributeDto.transactionId) {
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: contributeDto.transactionId },
      });

      if (!transaction || transaction.userId !== userId) {
        throw new NotFoundException('Transação não encontrada');
      }
    }

    const date = contributeDto.date ? new Date(contributeDto.date) : new Date();

    // Criar contribuição
    const contribution = await this.prisma.goalContribution.create({
      data: {
        goalId: id,
        transactionId: contributeDto.transactionId,
        amount: contributeDto.amount,
        date,
      },
    });

    // Atualizar valor atual do objetivo
    const newCurrentAmount = Number(goal.currentAmount) + contributeDto.amount;
    const targetAmount = Number(goal.targetAmount);

    const updateData: any = {
      currentAmount: newCurrentAmount,
    };

    // Se atingiu ou ultrapassou a meta, marcar como completado
    if (newCurrentAmount >= targetAmount && goal.status === 'ACTIVE') {
      updateData.status = 'COMPLETED';
      updateData.completedAt = new Date();
    }

    const updatedGoal = await this.prisma.goal.update({
      where: { id },
      data: updateData,
    });

    // VERIFICAR PROGRESSO E CRIAR NOTIFICAÇÕES (SE NECESSÁRIO)
    try {
      await this.notificationsService.checkGoalAchieved(id);
    } catch (error) {
      // Não quebrar o fluxo se falhar notificação
      console.error('Erro ao verificar progresso da meta:', error);
    }

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

  async getSummary(userId: string) {
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

    return {
      total: goals.length,
      active: active.length,
      completed: completed.length,
      cancelled: cancelled.length,
      totalTargeted,
      totalSaved,
      totalRemaining: totalTargeted - totalSaved,
      overallPercentage:
        totalTargeted > 0
          ? Math.round((totalSaved / totalTargeted) * 100 * 100) / 100
          : 0,
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
}
