import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CommonModule } from '../common/common.module';
import { OpenAiService } from './services/openai.service';
import { AiCategorizationService } from './services/ai-categorization.service';
import { AiUsageService } from './services/ai-usage.service';
import { AiConfigController } from './controllers/ai-config.controller';
import { AiUsageController } from './controllers/ai-usage.controller';

/**
 * AI Module
 * Handles all AI-related features:
 * - Automatic transaction categorization
 * - OCR (future)
 * - Bank notification processing (future)
 * - Financial assistant (future)
 */
@Module({
  imports: [CommonModule, AuditModule],
  controllers: [AiConfigController, AiUsageController],
  providers: [OpenAiService, AiCategorizationService, AiUsageService],
  exports: [AiCategorizationService, AiUsageService], // Export for use in TransactionsService
})
export class AiModule {}
