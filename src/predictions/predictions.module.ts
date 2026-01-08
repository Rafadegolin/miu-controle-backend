import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { PredictionsController } from './predictions.controller';
import { PredictionEngineService } from './services/prediction-engine.service';
import { PredictionsJob } from './predictions.job';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(), // Ensure ScheduleModule is available (might be redundant if in AppModule but safe)
  ],
  controllers: [PredictionsController],
  providers: [
    PredictionEngineService,
    PredictionsJob
  ],
  exports: [PredictionEngineService]
})
export class PredictionsModule {}
