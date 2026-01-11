import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MissionsService {
  private readonly logger = new Logger(MissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getActiveMissions(userId: string) {
       await this.ensureWeeklyMissions(userId);
       
       return this.prisma.userMission.findMany({
           where: { userId, status: 'ACTIVE' },
           include: { mission: true },
           orderBy: { createdAt: 'desc' }
       });
  }
  
  // --- ADMIN METHODS ---

  async findAllTemplates() {
      return this.prisma.mission.findMany({
          orderBy: { title: 'asc' }
      });
  }

  async create(data: any) {
      return this.prisma.mission.create({ data });
  }

  async update(id: string, data: any) {
      return this.prisma.mission.update({
          where: { id },
          data
      });
  }

  async delete(id: string) {
      // Soft delete or hard? Let's toggle active
      return this.prisma.mission.update({
          where: { id },
          data: { isActive: false }
      });
  }

  async ensureWeeklyMissions(userId: string) {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const existing = await this.prisma.userMission.findFirst({
          where: {
              userId,
              createdAt: { gte: startOfWeek }
          }
      });

      if (existing) return;

      // Generate missions (for MVP, pick random or static set)
      const missions = await this.prisma.mission.findMany({
          where: { isActive: true, frequency: 'WEEKLY' }
      });
      
      // If no missions in DB, seed some default ones
      if (missions.length === 0) {
          await this.seedDefaultMissions();
          return this.ensureWeeklyMissions(userId); // Retry
      }

      // Assign 3 random missions
      const shuffled = missions.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 3);
      
      const expiresAt = new Date(startOfWeek);
      expiresAt.setDate(expiresAt.getDate() + 7);

      for (const mission of selected) {
          await this.prisma.userMission.create({
              data: {
                  userId,
                  missionId: mission.id,
                  target: (mission.criteria as any).target || 1,
                  expiresAt
              }
          });
      }
      
      this.logger.log(`Generated ${selected.length} weekly missions for user ${userId}`);
  }

  async updateMissionProgress(userId: string, type: string, amount: number = 1) {
      const activeMissions = await this.prisma.userMission.findMany({
          where: { userId, status: 'ACTIVE' },
          include: { mission: true }
      });

      for (const userMission of activeMissions) {
          const criteria = userMission.mission.criteria as any; // { type: 'TRANSACTION_COUNT', target: 5 }
          
          if (criteria.type === type) {
              const newProgress = userMission.progress + amount;
              const completed = newProgress >= userMission.target;
              
              await this.prisma.userMission.update({
                  where: { id: userMission.id },
                  data: {
                      progress: newProgress,
                      status: completed ? 'COMPLETED' : 'ACTIVE',
                      completedAt: completed ? new Date() : null
                  }
              });
              
              if (completed) {
                  // Award XP for mission completion!
                  // Ideally we inject GamificationService here but circular dependency risk.
                  // For now, assume GamificationListener handles "mission.completed" event or we do direct DB update
                  // OR better: emit event 'mission.completed'
                  this.logger.log(`Mission ${userMission.id} completed!`);
              }
          }
      }
  }

  private async seedDefaultMissions() {
      const defaults = [
          { code: 'WEEKLY_TX_5', title: 'Registro Constante', description: 'Faça 5 transações esta semana', xpReward: 100, frequency: 'WEEKLY', criteria: { type: 'TRANSACTION_COUNT', target: 5 } },
          { code: 'WEEKLY_GOAL_1', title: 'Foco no Futuro', description: 'Contribua para uma meta', xpReward: 150, frequency: 'WEEKLY', criteria: { type: 'GOAL_CONTRIBUTION', target: 1 } },
      ];
      
      for (const m of defaults) {
          await this.prisma.mission.upsert({
              where: { code: m.code },
              update: {},
              create: {
                  code: m.code,
                  title: m.title,
                  description: m.description,
                  xpReward: m.xpReward,
                  frequency: m.frequency as any,
                  criteria: m.criteria
              }
          });
      }
  }
}
