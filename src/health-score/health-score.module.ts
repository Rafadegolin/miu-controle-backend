import { Module } from '@nestjs/common';
import { HealthScoreController } from './health-score.controller';
import { HealthScoreService } from './health-score.service';
import { AchievementsService } from './achievements.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [HealthScoreController],
  providers: [HealthScoreService, AchievementsService],
  exports: [HealthScoreService],
})
export class HealthScoreModule {}
