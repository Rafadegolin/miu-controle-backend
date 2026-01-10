import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserAchievements(userId: string) {
    const allAchievements = await this.prisma.achievement.findMany();
    const unlocked = await this.prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true },
    });
    
    const unlockedIds = new Set(unlocked.map(ua => ua.achievementId));

    return {
      unlocked: unlocked.map(ua => ({
        ...ua.achievement,
        unlockedAt: ua.unlockedAt
      })),
      locked: allAchievements.filter(a => !unlockedIds.has(a.id)),
      totalPoints: unlocked.reduce((acc, curr) => acc + curr.achievement.points, 0)
    };
  }

  async checkAchievements(userId: string) {
    const userAchievements = await this.prisma.userAchievement.findMany({ 
        where: { userId },
        select: { achievement: { select: { code: true } } }
    });
    const unlockedCodes = new Set(userAchievements.map(ua => ua.achievement.code));
    const newUnlocks: string[] = [];

    // 1. FIRST_TRANSACTION
    if (!unlockedCodes.has('FIRST_TRANSACTION')) {
        const count = await this.prisma.transaction.count({ where: { userId } });
        if (count > 0) newUnlocks.push('FIRST_TRANSACTION');
    }

    // 2. GOAL_REACHED
    if (!unlockedCodes.has('GOAL_REACHED')) {
        const completedGoals = await this.prisma.goal.count({ where: { userId, status: 'COMPLETED' } });
        if (completedGoals > 0) newUnlocks.push('GOAL_REACHED');
    }

    // 3. SAFE_RESERVE (3 months coverage)
    if (!unlockedCodes.has('SAFE_RESERVE')) {
        const fund = await this.prisma.emergencyFund.findUnique({ where: { userId } });
        if (fund && fund.monthsCovered.toNumber() >= 3) {
            newUnlocks.push('SAFE_RESERVE');
        }
    }

    // Persist new unlocks
    for (const code of newUnlocks) {
        const achievement = await this.prisma.achievement.findUnique({ where: { code } });
        if (achievement) {
            await this.prisma.userAchievement.create({
                data: { userId, achievementId: achievement.id }
            });
            this.logger.log(`User ${userId} unlocked achievement: ${code}`);
        }
    }
  }

  async seedBadges() {
     const badges = [
         { code: 'FIRST_TRANSACTION', name: 'Primeiro Passo', description: 'Registre sua primeira transação', icon: '🏁', points: 50 },
         { code: 'WEEK_STREAK', name: 'Semana Completa', description: 'Registre transações por 7 dias seguidos', icon: '🔥', points: 100 },
         { code: 'GOAL_REACHED', name: 'Sonho Realizado', description: 'Conclua sua primeira meta', icon: '🎯', points: 150 },
         { code: 'SAFE_RESERVE', name: 'Porto Seguro', description: 'Tenha 3 meses de despesas cobertos', icon: '⚓', points: 200 },
         { code: 'BUDGET_MASTER', name: 'Mestre do Orçamento', description: 'Não estoure orçamentos por 3 meses', icon: '🥋', points: 250 },
     ];

     for (const badge of badges) {
         await this.prisma.achievement.upsert({
             where: { code: badge.code },
             update: {},
             create: badge
         });
     }
  }
}
