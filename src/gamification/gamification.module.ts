import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { MissionsService } from './missions.service';
import { GamificationListener } from './listeners/gamification.listener';
import { PrismaModule } from '../prisma/prisma.module';
import { HealthScoreModule } from '../health-score/health-score.module'; // To use AchievementsService if needed
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot(), HealthScoreModule, AiModule],
  controllers: [GamificationController],
  providers: [GamificationService, MissionsService, GamificationListener],
  exports: [GamificationService, MissionsService],
})
export class GamificationModule {}
