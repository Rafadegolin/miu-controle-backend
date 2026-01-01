import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { PredictiveAnalyticsService } from '../services/predictive-analytics.service';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class AnomalyDetectionJob {
  private readonly logger = new Logger(AnomalyDetectionJob.name);

  constructor(
    private prisma: PrismaService,
    private predictiveService: PredictiveAnalyticsService,
    private notificationService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async detectDailyAnomalies() {
    this.logger.log('Starting daily anomaly detection...');

    try {
      // Fetch all users with AI enabled
      const users = await this.prisma.userAiConfig.findMany({
        where: { isAiEnabled: true },
        select: { userId: true },
      });

      this.logger.log(`Processing ${users.length} users for anomaly detection...`);

      let totalAnomalies = 0;

      for (const { userId } of users) {
        try {
          const anomalies = await this.predictiveService.detectDailyAnomalies(userId);
          
          if (anomalies && anomalies.length > 0) {
            totalAnomalies += anomalies.length;
            this.logger.log(`User ${userId}: Detected ${anomalies.length} anomalies.`);
            
            // Notify user about first major anomaly
            // await this.notificationService.sendAnomalyAlert(userId, anomalies[0]);
          }
        } catch (err) {
          this.logger.error(`Error processing user ${userId}: ${err.message}`);
        }
      }

      this.logger.log(`Finished anomaly detection. Total found: ${totalAnomalies}`);

    } catch (error) {
      this.logger.error(`Failed to run anomaly detection job: ${error.message}`);
    }
  }
}
