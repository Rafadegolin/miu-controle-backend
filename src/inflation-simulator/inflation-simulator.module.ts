import { Module } from '@nestjs/common';
import { InflationSimulatorController } from './inflation-simulator.controller';
import { InflationSimulatorService } from './inflation-simulator.service';
import { GoalsModule } from '../goals/goals.module';
import { BudgetsModule } from '../budgets/budgets.module';

@Module({
  imports: [GoalsModule, BudgetsModule],
  controllers: [InflationSimulatorController],
  providers: [InflationSimulatorService],
})
export class InflationSimulatorModule {}
