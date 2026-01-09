import { Module } from '@nestjs/common';
import { AffordabilityController } from './affordability.controller';
import { AffordabilityService } from './affordability.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScenariosModule } from '../scenarios/scenarios.module';
import { BudgetsModule } from '../budgets/budgets.module';

@Module({
  imports: [PrismaModule, ScenariosModule, BudgetsModule],
  controllers: [AffordabilityController],
  providers: [AffordabilityService],
})
export class AffordabilityModule {}
