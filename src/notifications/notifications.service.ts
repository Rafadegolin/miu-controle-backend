import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationType } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Cria notificação in-app
   */
  async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: any,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data: data || {},
      },
    });
  }

  /**
   * Lista notificações do usuário
   */
  async findAll(userId: string, unreadOnly: boolean = false) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { read: false }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limitar a 50 mais recentes
    });
  }

  /**
   * Conta notificações não lidas
   */
  async countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }

  /**
   * Marca notificações como lidas
   */
  async markAsRead(userId: string, ids: string[]) {
    const result = await this.prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId, // Garantir que pertence ao usuário
      },
      data: {
        read: true,
      },
    });

    return {
      message: `${result.count} notificação(ões) marcada(s) como lida(s)`,
      count: result.count,
    };
  }

  /**
   * Marca todas como lidas
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return {
      message: `${result.count} notificação(ões) marcada(s) como lida(s)`,
      count: result.count,
    };
  }

  /**
   * Deleta notificação
   */
  async remove(userId: string, id: string) {
    await this.prisma.notification.deleteMany({
      where: {
        id,
        userId, // Garantir que pertence ao usuário
      },
    });

    return {
      message: 'Notificação deletada com sucesso',
    };
  }

  /**
   * Deleta todas as lidas
   */
  async clearRead(userId: string) {
    const result = await this.prisma.notification.deleteMany({
      where: {
        userId,
        read: true,
      },
    });

    return {
      message: `${result.count} notificação(ões) deletada(s)`,
      count: result.count,
    };
  }

  // ==================== JOBS AUTOMÁTICOS ====================

  /**
   * Verifica orçamentos excedidos (roda todo dia às 20h)
   */
  @Cron(CronExpression.EVERY_DAY_AT_8PM)
  async checkBudgets() {
    this.logger.log('🔔 Verificando orçamentos...');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Buscar todos os orçamentos ativos
    const budgets = await this.prisma.budget.findMany({
      where: {
        period: 'MONTHLY',
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      },
      include: {
        user: true,
        category: true,
      },
    });

    for (const budget of budgets) {
      // Calcular gasto total da categoria no mês
      const spent = await this.prisma.transaction.aggregate({
        where: {
          userId: budget.userId,
          categoryId: budget.categoryId,
          type: 'EXPENSE',
          status: 'COMPLETED',
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _sum: {
          amount: true,
        },
      });

      const totalSpent = Number(spent._sum.amount || 0);
      const budgetAmount = Number(budget.amount);
      const percentage = (totalSpent / budgetAmount) * 100;

      // Verificar se já existe notificação recente (últimas 24h)
      const recentNotification = await this.prisma.notification.findFirst({
        where: {
          userId: budget.userId,
          type: { in: ['BUDGET_ALERT', 'BUDGET_EXCEEDED'] },
          data: {
            path: ['budgetId'],
            equals: budget.id,
          },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      // Não notificar se já notificou nas últimas 24h
      if (recentNotification) continue;

      // ALERTA: Atingiu % de alerta (padrão 80%)
      if (percentage >= budget.alertPercentage && percentage < 100) {
        await this.create(
          budget.userId,
          'BUDGET_ALERT',
          '⚠️ Alerta de Orçamento',
          `Você gastou ${percentage.toFixed(0)}% do orçamento de "${budget.category.name}" (R$ ${totalSpent.toFixed(2)} de R$ ${budgetAmount.toFixed(2)})`,
          {
            budgetId: budget.id,
            categoryName: budget.category.name,
            spent: totalSpent,
            budget: budgetAmount,
            percentage: percentage.toFixed(2),
          },
        );

        // Enviar email
        try {
          await this.sendBudgetAlertEmail(
            budget.user.email,
            budget.user.fullName,
            budget.category.name,
            totalSpent,
            budgetAmount,
            percentage,
          );
        } catch (error) {
          this.logger.error('Erro ao enviar email de alerta:', error);
        }
      }

      // EXCEDIDO: Passou de 100%
      if (percentage >= 100) {
        await this.create(
          budget.userId,
          'BUDGET_EXCEEDED',
          '🚨 Orçamento Estourado!',
          `Você estourou o orçamento de "${budget.category.name}"! Gastou R$ ${totalSpent.toFixed(2)} de R$ ${budgetAmount.toFixed(2)} (${percentage.toFixed(0)}%)`,
          {
            budgetId: budget.id,
            categoryName: budget.category.name,
            spent: totalSpent,
            budget: budgetAmount,
            percentage: percentage.toFixed(2),
          },
        );

        // Enviar email
        try {
          await this.sendBudgetExceededEmail(
            budget.user.email,
            budget.user.fullName,
            budget.category.name,
            totalSpent,
            budgetAmount,
            percentage,
          );
        } catch (error) {
          this.logger.error('Erro ao enviar email de excesso:', error);
        }
      }
    }

    this.logger.log('✅ Verificação de orçamentos concluída');
  }

  /**
   * Verifica metas atingidas
   */
  async checkGoalAchieved(goalId: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      include: { user: true },
    });

    if (!goal || goal.status !== 'ACTIVE') return;

    const currentAmount = Number(goal.currentAmount);
    const targetAmount = Number(goal.targetAmount);
    const percentage = (currentAmount / targetAmount) * 100;

    // Meta atingida (100%)
    if (percentage >= 100 && goal.status === 'ACTIVE') {
      // Atualizar status da meta
      await this.prisma.goal.update({
        where: { id: goalId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Criar notificação
      await this.create(
        goal.userId,
        'GOAL_ACHIEVED',
        '🎉 Meta Atingida!',
        `Parabéns! Você atingiu sua meta "${goal.name}"! R$ ${currentAmount.toFixed(2)} de R$ ${targetAmount.toFixed(2)}`,
        {
          goalId: goal.id,
          goalName: goal.name,
          amount: currentAmount,
          target: targetAmount,
        },
      );

      // Enviar email
      try {
        await this.sendGoalAchievedEmail(
          goal.user.email,
          goal.user.fullName,
          goal.name,
          currentAmount,
          targetAmount,
        );
      } catch (error) {
        this.logger.error('Erro ao enviar email de meta:', error);
      }
    }

    // Milestones (25%, 50%, 75%)
    const milestones = [25, 50, 75];
    for (const milestone of milestones) {
      if (percentage >= milestone && percentage < milestone + 5) {
        // Verificar se já notificou esse milestone
        const existing = await this.prisma.notification.findFirst({
          where: {
            userId: goal.userId,
            type: 'GOAL_MILESTONE',
            data: {
              path: ['goalId'],
              equals: goalId,
            },
            message: {
              contains: `${milestone}%`,
            },
          },
        });

        if (!existing) {
          await this.create(
            goal.userId,
            'GOAL_MILESTONE',
            `🎯 ${milestone}% da Meta!`,
            `Você atingiu ${milestone}% da meta "${goal.name}"! Continue assim!`,
            {
              goalId: goal.id,
              goalName: goal.name,
              milestone,
              percentage: percentage.toFixed(2),
            },
          );
        }
      }
    }
  }

  // ==================== EMAILS ====================

  private async sendBudgetAlertEmail(
    to: string,
    userName: string,
    categoryName: string,
    spent: number,
    budget: number,
    percentage: number,
  ) {
    const subject = `⚠️ Alerta de Orçamento - ${categoryName}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px;">
            <h2 style="color: #F59E0B;">⚠️ Alerta de Orçamento</h2>
            <p>Olá, ${userName}!</p>
            <p>Você gastou <strong>${percentage.toFixed(0)}%</strong> do seu orçamento de <strong>${categoryName}</strong>.</p>
            <div style="margin: 20px 0; padding: 20px; background-color: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 4px;">
              <p style="margin: 0; color: #92400E;">
                <strong>Gasto:</strong> R$ ${spent.toFixed(2)}<br>
                <strong>Orçamento:</strong> R$ ${budget.toFixed(2)}<br>
                <strong>Restante:</strong> R$ ${(budget - spent).toFixed(2)}
              </p>
            </div>
            <p>Fique atento aos seus gastos para não estourar o orçamento!</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              Miu Controle - Controle suas finanças
            </p>
          </div>
        </body>
      </html>
    `;

    await this.emailService.sendEmail(to, subject, html);
  }

  private async sendBudgetExceededEmail(
    to: string,
    userName: string,
    categoryName: string,
    spent: number,
    budget: number,
    percentage: number,
  ) {
    const subject = `🚨 Orçamento Estourado - ${categoryName}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px;">
            <h2 style="color: #EF4444;">🚨 Orçamento Estourado!</h2>
            <p>Olá, ${userName}!</p>
            <p>Você <strong>estourou</strong> o orçamento de <strong>${categoryName}</strong>!</p>
            <div style="margin: 20px 0; padding: 20px; background-color: #FEE2E2; border-left: 4px solid #EF4444; border-radius: 4px;">
              <p style="margin: 0; color: #991B1B;">
                <strong>Gasto:</strong> R$ ${spent.toFixed(2)}<br>
                <strong>Orçamento:</strong> R$ ${budget.toFixed(2)}<br>
                <strong>Excedeu:</strong> R$ ${(spent - budget).toFixed(2)} (${percentage.toFixed(0)}%)
              </p>
            </div>
            <p>Revise seus gastos e ajuste seu planejamento financeiro.</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              Miu Controle - Controle suas finanças
            </p>
          </div>
        </body>
      </html>
    `;

    await this.emailService.sendEmail(to, subject, html);
  }

  private async sendGoalAchievedEmail(
    to: string,
    userName: string,
    goalName: string,
    amount: number,
    target: number,
  ) {
    const subject = `🎉 Meta Atingida - ${goalName}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px;">
            <h2 style="color: #10B981;">🎉 Parabéns! Meta Atingida!</h2>
            <p>Olá, ${userName}!</p>
            <p>Você atingiu sua meta <strong>"${goalName}"</strong>!</p>
            <div style="margin: 20px 0; padding: 20px; background-color: #D1FAE5; border-left: 4px solid #10B981; border-radius: 4px;">
              <p style="margin: 0; color: #065F46;">
                <strong>Valor Atingido:</strong> R$ ${amount.toFixed(2)}<br>
                <strong>Meta:</strong> R$ ${target.toFixed(2)}
              </p>
            </div>
            <p>Continue assim e conquiste seus objetivos financeiros! 💪</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              Miu Controle - Controle suas finanças
            </p>
          </div>
        </body>
      </html>
    `;

    await this.emailService.sendEmail(to, subject, html);
  }
}
