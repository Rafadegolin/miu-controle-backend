import { Module } from '@nestjs/common';
import { ProactiveAlertsController } from './proactive-alerts.controller';
import { ProactiveAlertsService } from './proactive-alerts.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ProactiveAlertsController],
  providers: [ProactiveAlertsService],
  exports: [ProactiveAlertsService]
})
export class ProactiveAlertsModule {}
