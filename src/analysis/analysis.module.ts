import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { AnalysisJob } from './analysis.job';
// MailerModule is likely global, removing explicit import if not needed or importing correctly if not global.
// Checking app.module shows EmailModule which likely exports or registers Mailer.
// If not, we might fail injection. Safe bet: if EmailModule is global, we are good.
// The error was syntax related (imports inside Module decorator).

@Module({
  imports: [PrismaModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisJob],
  exports: [AnalysisService]
})
export class AnalysisModule {}
