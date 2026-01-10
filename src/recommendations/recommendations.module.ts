import { Module } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsController } from './recommendations.controller';
import { AiModule } from '../ai/ai.module';
import { ExpenseReducerAnalyzer } from './analyzers/expense-reducer.analyzer';
import { SubscriptionReviewerAnalyzer } from './analyzers/subscription-reviewer.analyzer';
import { BudgetOptimizerAnalyzer } from './analyzers/budget-optimizer.analyzer';
import { OpportunityDetectorAnalyzer } from './analyzers/opportunity-detector.analyzer';
import { RiskAlertAnalyzer } from './analyzers/risk-alert.analyzer';

@Module({
  imports: [
    AiModule,
  ],
  controllers: [RecommendationsController],
  providers: [
    RecommendationsService,
    ExpenseReducerAnalyzer,
    SubscriptionReviewerAnalyzer,
    BudgetOptimizerAnalyzer,
    OpportunityDetectorAnalyzer,
    RiskAlertAnalyzer,
  ],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
