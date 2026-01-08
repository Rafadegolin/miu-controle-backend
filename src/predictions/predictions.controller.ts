import { Controller, Get, Query, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PredictionEngineService } from './services/prediction-engine.service';
import { ExpensePredictionDto } from './dto/expense-prediction.dto';

@Controller('predictions')
@UseGuards(JwtAuthGuard)
export class PredictionsController {
  constructor(private readonly predictionService: PredictionEngineService) {}

  @Get('variable-expenses')
  async getVariableExpenses(
    @Req() req,
    @Query('month') monthStr: string // YYYY-MM
  ) {
    const userId = req.user.id;
    
    // 1. Detect variable categories
    const variableCategoryIds = await this.predictionService.detectVariableCategories(userId);
    
    // 2. Predict for each
    const targetDate = monthStr ? new Date(`${monthStr}-01`) : new Date();
    
    const predictions = [];
    
    for (const catId of variableCategoryIds) {
      const pred = await this.predictionService.predictCategoryExpense(userId, catId, targetDate);
      if (pred) predictions.push(pred);
    }

    return {
      month: monthStr,
      predictions
    };
  }

  @Get('category/:categoryId')
  async getCategoryPrediction(
    @Req() req,
    @Param('categoryId') categoryId: string
  ) {
    const userId = req.user.id;
    // Predict for next month by default
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    return this.predictionService.predictCategoryExpense(userId, categoryId, nextMonth);
  }
}
