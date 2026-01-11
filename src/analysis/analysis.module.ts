import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { AnalysisJob } from './analysis.job';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisJob],
  exports: [AnalysisService]
})
export class AnalysisModule {}
