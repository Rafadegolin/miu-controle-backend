import { Module } from '@nestjs/common';
import { PlanningService } from './planning.service';
import { PlanningController } from './planning.controller';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [AnalysisModule],
  providers: [PlanningService],
  controllers: [PlanningController]
})
export class PlanningModule {}
