import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';

export interface EmergencyFundStatus {
  currentAmount: number;
  targetAmount: number;
  monthsCovered: number;
  status: 'CRITICAL' | 'WARNING' | 'SECURE';
  percentage: number;
}

@Injectable()
export class EmergencyFundService {
  private readonly logger = new Logger(EmergencyFundService.name);

  constructor(
      private prisma: PrismaService,
      private notificationsService: NotificationsService
  ) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async handleMonthlyRecalculation() {
    this.logger.log('Starting monthly emergency fund recalculation...');
    const funds = await this.prisma.emergencyFund.findMany({ where: { isActive: true } });
    
    for (const fund of funds) {
        try {
            const monthlyEssential = await this.calculateEssentialExpenses(fund.userId);
            if (monthlyEssential > 0) {
               // Update target if significantly different? 
               // For now, let's just log or auto-update if strictly required.
               // Requirement says "Ajustar meta se necessário".
               const newTarget = monthlyEssential * 6; // Keep 6 months rule
               
               // Only update if difference > 10% to avoid noise
               if (Math.abs(newTarget - Number(fund.targetAmount)) / Number(fund.targetAmount) > 0.1) {
                   await this.prisma.emergencyFund.update({
                       where: { id: fund.id },
                       data: { targetAmount: newTarget }
                   });
                   this.logger.log(`Updated target for user ${fund.userId} to ${newTarget}`);
               }

               // Verify progress and Notify if below ideal
               const currentAmount = Number(fund.currentAmount);
               const monthsCovered = currentAmount / monthlyEssential;
               
               if (monthsCovered < 3) {
                   await this.notificationsService.create(
                       fund.userId,
                       'SYSTEM',
                       '⚠️ Colchão Financeiro Abaixo do Ideal',
                       `Seu colchão cobre apenas ${monthsCovered.toFixed(1)} meses. O recomendado é no mínimo 3 meses.`,
                       { monthsCovered, targetMonths: 6 }
                   );
               }
             }
        } catch (e) {
            this.logger.error(`Failed to recalculate for fund ${fund.id}`, e);
        }
    }
  }

  async calculateEssentialExpenses(userId: string): Promise<number> {
    // 1. Get essential categories
    const essentialCategories = await this.prisma.category.findMany({
      where: { userId, isEssential: true },
      select: { id: true }
    });
    
    const categoryIds = essentialCategories.map(c => c.id);
    if (categoryIds.length === 0) return 0;

    // 2. Calculate average spending in last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const expenses = await this.prisma.transaction.aggregate({
      where: {
        userId,
        categoryId: { in: categoryIds },
        type: 'EXPENSE',
        date: { gte: threeMonthsAgo }
      },
      _sum: { amount: true }
    });

    const totalExpense = Number(expenses._sum.amount || 0);
    return totalExpense / 3;
  }

  async setup(userId: string) {
    const existing = await this.prisma.emergencyFund.findUnique({ where: { userId } });
    if (existing) throw new BadRequestException('Emergency fund already setup');

    const monthlyEssential = await this.calculateEssentialExpenses(userId);
    // Target: 6 months of essential expenses (safe default)
    const targetAmount = Math.max(monthlyEssential * 6, 1000); // Minimum 1000 if no data

    return this.prisma.emergencyFund.create({
      data: {
        userId,
        targetAmount,
        monthsCovered: 0,
        linkedGoalId: null // User can link later
      }
    });
  }

  async getStatus(userId: string): Promise<EmergencyFundStatus> {
    const fund = await this.prisma.emergencyFund.findUnique({ where: { userId } });
    if (!fund) {
        // Return a provisional status or throw?
        // Let's return zeros so the frontend knows to show "Setup"
        return { 
            currentAmount: 0, 
            targetAmount: 0, 
            monthsCovered: 0, 
            status: 'CRITICAL', 
            percentage: 0 
        };
    }

    const current = Number(fund.currentAmount);
    const target = Number(fund.targetAmount);
    
    // Recalculate months covered dynamically based on current essential expenses? 
    // Or use the stored target which represents X months?
    // Let's use target assuming target = 6 months.
    // So 1 month amount = target / 6.
    const monthlyEstimate = target / 6; 
    const monthsCovered = monthlyEstimate > 0 ? current / monthlyEstimate : 0;

    let status: 'CRITICAL' | 'WARNING' | 'SECURE' = 'CRITICAL';
    if (monthsCovered >= 3) status = 'SECURE';
    else if (monthsCovered >= 1) status = 'WARNING';

    return {
      currentAmount: current,
      targetAmount: target,
      monthsCovered: Number(monthsCovered.toFixed(1)),
      status,
      percentage: Math.min((current / target) * 100, 100)
    };
  }

  async withdraw(userId: string, amount: number, reason: string) {
    const fund = await this.prisma.emergencyFund.findUnique({ where: { userId } });
    if (!fund) throw new NotFoundException('Emergency fund not found');
    
    if (Number(fund.currentAmount) < amount) {
        throw new BadRequestException('Insufficient funds');
    }

    return this.prisma.$transaction(async (tx) => {
        // 1. Create withdrawal record
        await tx.emergencyFundWithdrawal.create({
            data: {
                fundId: fund.id,
                amount,
                reason,
                approved: true // Auto-approved for now
            }
        });

        // 2. Decrement fund
        const updated = await tx.emergencyFund.update({
            where: { id: fund.id },
            data: {
                currentAmount: { decrement: amount }
            }
        });
        
        // 3. Log/Notification
        await this.notificationsService.create(
            userId,
            'SYSTEM', // Or specific type like EMERGENCY_WITHDRAWAL if available
            '🚨 Saque de Emergência',
            `Saque de R$ ${amount.toFixed(2)} realizado. Motivo: ${reason}`,
            { amount, reason }
        );

        // 4. Update Linked Goal
        if (fund.linkedGoalId) {
             await tx.goal.update({
                 where: { id: fund.linkedGoalId },
                 data: { currentAmount: { decrement: amount } }
             });
        }

        return updated;
    });
  }

  async contribute(userId: string, amount: number) {
      const fund = await this.prisma.emergencyFund.findUnique({ where: { userId } });
      if (!fund) throw new NotFoundException('Fund not found');

      return this.prisma.$transaction(async (tx) => {
          const updated = await tx.emergencyFund.update({
              where: { userId },
              data: { currentAmount: { increment: amount } }
          });

          // Check Milestones
          await this.checkMilestones(userId, updated);

          if (fund.linkedGoalId) {
             await tx.goal.update({
                 where: { id: fund.linkedGoalId },
                 data: { currentAmount: { increment: amount } }
             });
          }
          return updated;
      });
  }

  async updateSettings(userId: string, data: { targetAmount?: number; linkedGoalId?: string }) {
      return this.prisma.emergencyFund.update({
          where: { userId },
          data: {
              ...(data.targetAmount && { targetAmount: data.targetAmount }),
              ...(data.linkedGoalId && { linkedGoalId: data.linkedGoalId })
          }
      });
  }

  private async checkMilestones(userId: string, fund: any) {
      const current = Number(fund.currentAmount);
      const target = Number(fund.targetAmount);
      const monthsCovered = (current / target) * 6; // Approx
      
      const milestones = [1, 3, 6];
      for (const m of milestones) {
          if (monthsCovered >= m && monthsCovered < m + 0.5) { // Simple range check to avoid spam
             // In real app, check if already notified for this month/milestone
             // For now, simple notification
             await this.notificationsService.create(
                 userId,
                 'GOAL_MILESTONE',
                 `🏆 Marco Atingido!`,
                 `Você já cobriu ${m} meses de despesas essenciais!`,
                 { monthsCovered: m }
             );
          }
      }
  }

  async getHistory(userId: string) {
    const fund = await this.prisma.emergencyFund.findUnique({
      where: { userId },
      include: { 
        withdrawals: { orderBy: { createdAt: 'desc' } }
      }
    });
    
    if (!fund) throw new NotFoundException('Fund not found');
    return fund.withdrawals;
  }
}
