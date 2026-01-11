import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from '../health-score/achievements.service';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly achievementsService: AchievementsService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, currentXp: true, streakCurrent: true, streakLongest: true }
    });
    
    // Calculate next level: simplified (level * 1000)
    const nextLevelXp = user.level * 1000;
    
    return {
       ...user,
       nextLevelXp,
       progress: Math.floor((user.currentXp / nextLevelXp) * 100)
    };
  }

  async awardXp(userId: string, amount: number, source: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    let newXp = user.currentXp + amount;
    let newLevel = user.level;
    let levelUp = false;

    const xpToNextLevel = newLevel * 1000; // Simple curve

    if (newXp >= xpToNextLevel) {
       newXp -= xpToNextLevel;
       newLevel++;
       levelUp = true;
       // Might trigger level up bonus/badge here
       this.logger.log(`User ${userId} leveled up to ${newLevel}!`);
    }

    await this.prisma.user.update({
        where: { id: userId },
        data: {
            currentXp: newXp,
            level: newLevel,
        }
    });
    
    this.logger.log(`Awarded ${amount} XP to ${userId} for ${source}. New XP: ${newXp}`);
  }

  async updateStreak(userId: string) {
     const user = await this.prisma.user.findUnique({ where: { id: userId } });
     const today = new Date();
     const lastActivity = user.lastActivityDate ? new Date(user.lastActivityDate) : null;
     
     // Normalize to date only
     const isSameDay = lastActivity && lastActivity.toISOString().split('T')[0] === today.toISOString().split('T')[0];
     
     if (isSameDay) return; // Already counted today

     // Check if consecutive (last activity was yesterday)
     const yesterday = new Date();
     yesterday.setDate(yesterday.getDate() - 1);
     
     const isConsecutive = lastActivity && lastActivity.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0];
     
     let newStreak = isConsecutive ? user.streakCurrent + 1 : 1;
     // Allow one grace day? (Not implemented yet to keep simple, strict streak for now)
     
     const newLongest = Math.max(newStreak, user.streakLongest);

     await this.prisma.user.update({
         where: { id: userId },
         data: {
             streakCurrent: newStreak,
             streakLongest: newLongest,
             lastActivityDate: today
         }
     });
     
     // Check streak badges
     // await this.achievementsService.checkStreakBadges(userId, newStreak);
  }
}
