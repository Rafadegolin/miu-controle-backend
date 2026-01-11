import { Module } from '@nestjs/common';
import { CommonModule } from 'src/common/common.module';
import { AuditModule } from 'src/audit/audit.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { OpenAiService } from './services/openai.service';
import { AiCategorizationService } from './services/ai-categorization.service';
import { AiUsageService } from './services/ai-usage.service';
import { AiKeyManagerService } from './services/ai-key-manager.service';
import { GeminiService } from './services/gemini.service';
import { PredictiveAnalyticsService } from './services/predictive-analytics.service';
import { AnomalyDetectionJob } from './jobs/anomaly-detection.job';

import { AiConfigController } from './controllers/ai-config.controller';
import { AiUsageController } from './controllers/ai-usage.controller';
import { AnalyticsController } from './controllers/analytics.controller';

/**
 * AI Module
 */
@Module({
  imports: [CommonModule, AuditModule, NotificationsModule],
  controllers: [
    AiConfigController, 
    AiUsageController,
    AnalyticsController,
  ],
  providers: [
    OpenAiService, 
    AiCategorizationService, 
    AiUsageService,
    AiKeyManagerService,
    GeminiService,
    PredictiveAnalyticsService,
    AnomalyDetectionJob,
  ],
  exports: [
    AiCategorizationService, 
    AiUsageService,
    AiKeyManagerService,
    GeminiService,
    PredictiveAnalyticsService,
    OpenAiService,
  ],
})
export class AiModule {}
