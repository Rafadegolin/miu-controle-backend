import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertPriority } from '@prisma/client';

@Injectable()
export class ProactiveAlertsService {
  private readonly logger = new Logger(ProactiveAlertsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  @Cron('0 6 * * *') // 6:00 AM daily
  async runDailyChecks() {
    this.logger.log('Running daily proactive checks...');
    const users = await this.prisma.user.findMany({ 
        where: { emailVerified: true },
        select: { id: true }
    });

    for (const user of users) {
        await this.checkNegativeBalance(user.id);
        await this.checkUpcomingBills(user.id);
        await this.checkBudgetStatus(user.id);
        await this.checkPositiveStreaks(user.id);
    }
  }

  async checkNegativeBalance(userId: string) {
      // 1. Get current balance
      const accounts = await this.prisma.account.findMany({ where: { userId, isActive: true } });
      let currentBalance = accounts.reduce((sum, acc) => sum + Number(acc.currentBalance), 0);

      // 2. Look ahead 7 days for recurring expenses and installments
      // Note: This is simplified. Ideally we use the ScenariosService/Projection logic, but let's keep it lightweight here.
      // Or we can query the 'RecurringTransaction' model for next occurrences
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const recurring = await this.prisma.recurringTransaction.findMany({
          where: {
              userId,
              isActive: true,
              nextOccurrence: { lte: nextWeek },
              type: 'EXPENSE'
          }
      });
      
      const projectedOutgoing = recurring.reduce((sum, r) => sum + Number(r.amount), 0);
      
      if (currentBalance - projectedOutgoing < 0) {
          await this.createAlert(
              userId,
              'NEGATIVE_BALANCE',
              AlertPriority.CRITICAL,
              `Atenção! Seu saldo pode ficar negativo nos próximos 7 dias. Despesas previstas: R$ ${projectedOutgoing}.`,
              true
          );
      }
  }

  async checkUpcomingBills(userId: string) {
      // Similar to recurring, but specifically looking for "bills" or immediate 48h checks
      const twoDays = new Date();
      twoDays.setDate(twoDays.getDate() + 2);

      const bills = await this.prisma.recurringTransaction.findMany({
          where: {
              userId,
              isActive: true,
              nextOccurrence: { lte: twoDays },
              type: 'EXPENSE'
          }
      });

      if (bills.length > 0) {
           await this.createAlert(
              userId,
              'BILL_DUE',
              AlertPriority.WARNING,
              `Você tem ${bills.length} contas vencendo em breve. Verifique se tem saldo.`,
              true
          );
      }
  }

  async checkBudgetStatus(userId: string) {
      // A notificação de 80% já existe no NotificationsModule. Aqui geramos
      // alertas proativos mais urgentes: orçamento perto do limite (>=90%) ou
      // já estourado (>=100%) no mês corrente.
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const budgets = await this.prisma.budget.findMany({
          where: { userId, period: 'MONTHLY' },
          include: { category: true },
      });

      for (const budget of budgets) {
          const limit = Number(budget.amount);
          if (limit <= 0) continue;

          const agg = await this.prisma.transaction.aggregate({
              where: {
                  userId,
                  categoryId: budget.categoryId,
                  type: 'EXPENSE',
                  date: { gte: start, lte: end },
              },
              _sum: { amount: true },
          });
          const spent = Number(agg._sum.amount || 0);
          const pct = (spent / limit) * 100;
          const categoryName = budget.category?.name ?? 'categoria';

          if (pct >= 100) {
              await this.createAlert(
                  userId,
                  `BUDGET_EXCEEDED_${budget.id}`,
                  AlertPriority.CRITICAL,
                  `Você estourou o orçamento de ${categoryName}: R$ ${spent.toFixed(2)} de R$ ${limit.toFixed(2)}.`,
                  true,
              );
          } else if (pct >= 90) {
              await this.createAlert(
                  userId,
                  `BUDGET_NEAR_${budget.id}`,
                  AlertPriority.WARNING,
                  `Seu orçamento de ${categoryName} está em ${pct.toFixed(0)}% (R$ ${spent.toFixed(2)} de R$ ${limit.toFixed(2)}).`,
                  true,
              );
          }
      }
  }

  async checkPositiveStreaks(userId: string) {
      // Reforço positivo: usuário registrou transações em cada um dos últimos
      // 7 dias (consistência no lançamento — comportamento que queremos premiar).
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);

      const transactions = await this.prisma.transaction.findMany({
          where: { userId, date: { gte: sevenDaysAgo, lte: today } },
          select: { date: true },
      });

      const daysWithActivity = new Set(
          transactions.map((t) => t.date.toISOString().slice(0, 10)),
      );

      if (daysWithActivity.size >= 7) {
          await this.createAlert(
              userId,
              'POSITIVE_STREAK',
              AlertPriority.POSITIVE,
              'Parabéns! Você registrou seus gastos por 7 dias seguidos. Continue assim! 🎉',
              false,
          );
      }
  }

  async createAlert(
      userId: string, 
      type: string, 
      priority: AlertPriority, 
      message: string, 
      actionable = false, 
      actionUrl?: string
  ) {
      // Check for duplicate in last 24h
      const recent = await this.prisma.proactiveAlert.findFirst({
          where: {
              userId,
              type,
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
      });

      if (recent) return;

      // Create Alert
      const alert = await this.prisma.proactiveAlert.create({
          data: {
              userId,
              type,
              priority,
              message,
              actionable,
              actionUrl
          }
      });

      // Send Notification (Push/WebSocket)
      await this.notificationsService.create(
          userId,
          'SYSTEM', 
          this.getTitle(priority),
          message,
          { alertId: alert.id }
      );
  }

  private getTitle(priority: AlertPriority) {
      switch(priority) {
          case 'CRITICAL': return '🚨 Ação Necessária';
          case 'WARNING': return '⚠️ Atenção';
          case 'POSITIVE': return '🎉 Parabéns';
          default: return 'ℹ️ Dica';
      }
  }
}
