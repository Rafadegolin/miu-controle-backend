import { Module } from '@nestjs/common';
import { ScenariosController } from './scenarios.controller';
import { ScenariosService } from './scenarios.service';
import { AnalysisModule } from '../analysis/analysis.module';
import { GoalsModule } from '../goals/goals.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AnalysisModule, GoalsModule, PrismaModule],
  controllers: [ScenariosController],
  providers: [ScenariosService],
  exports: [ScenariosService]
})
export class ScenariosModule {}
