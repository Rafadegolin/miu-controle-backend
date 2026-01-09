import { Module } from '@nestjs/common';
import { EmergencyFundService } from './emergency-fund.service';
import { EmergencyFundController } from './emergency-fund.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AnalysisModule } from '../analysis/analysis.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AnalysisModule, NotificationsModule],
  controllers: [EmergencyFundController],
  providers: [EmergencyFundService],
  exports: [EmergencyFundService]
})
export class EmergencyFundModule {}
