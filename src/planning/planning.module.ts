import { Module } from '@nestjs/common';
import { PlanningService } from './planning.service';
import { PlanningController } from './planning.controller';

@Module({
  providers: [PlanningService],
  controllers: [PlanningController]
})
export class PlanningModule {}
