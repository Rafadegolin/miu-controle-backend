import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionEngineService } from '../predictions/services/prediction-engine.service';
import { RecurringTransactionsService } from '../recurring-transactions/recurring-transactions.service';
import { CashFlowProjectionQueryDto, ProjectionScenario } from './dto/cash-flow-projection-query.dto';
import { CashFlowProjectionResponseDto, MonthlyProjectionDto } from './dto/cash-flow-projection-response.dto';

@Injectable()
export class ProjectionsService {
  private readonly logger = new Logger(ProjectionsService.name);

  constructor(
    private prisma: PrismaService,
    private predictionService: PredictionEngineService,
    private recurringService: RecurringTransactionsService,
  ) {}

  async calculateCashFlow(
    userId: string,
    query: CashFlowProjectionQueryDto
  ): Promise<CashFlowProjectionResponseDto> {
    const { months = 6, scenario = ProjectionScenario.REALISTIC } = query;
    
    // 1. Get Initial Balance (Current Accounts)
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { currentBalance: true }
    });
    const initialBalance = accounts.reduce((sum, acc) => sum + Number(acc.currentBalance), 0);

    // 2. Identify Prediction Factors
    const variableCategoryIds = await this.predictionService.detectVariableCategories(userId);
    
    // 3. Prepare Projection Loop
    const projections: MonthlyProjectionDto[] = [];
    let accumulatedBalance = initialBalance;
    const startDate = new Date();
    startDate.setDate(1); // Normalise to 1st
    
    // Pre-fetch recurring transactions to avoid DB calls in loop
    // But recurring service doesn't have a "simulate" method easily exposed without modifying it?
    // We can use findAll and filter manually or duplicate logic.
    // Ideally we'd use a method "getOccurrencesBetween(start, end)".
    // For now, let's fetch all active recurring and calculate manually.
    const recurringTransactions = await this.recurringService.findAll(userId, { isActive: true });

    for (let i = 0; i < months; i++) {
        const targetDate = new Date(startDate);
        targetDate.setMonth(targetDate.getMonth() + i);
        const monthKey = targetDate.toISOString().slice(0, 7);
        
        // --- FIXED Expenses & Income (Recurring) ---
        let fixedIncome = 0;
        let fixedExpenses = 0;
        
        for (const rt of recurringTransactions) {
            // Simple check: does it occur in this month?
            // This is complex for Weekly/Daily. 
            // Simplified approximation: Monthly amount
            let monthlyAmount = Number(rt.amount);
            
            if (rt.frequency === 'WEEKLY') monthlyAmount *= 4;
            if (rt.frequency === 'YEARLY') monthlyAmount /= 12; // Averaged? Or only in specific month?
            // Better: use specific month logic logic if YEARLY
            if (rt.frequency === 'YEARLY') {
                // Check if occurance falls in this month
                // RT.startDate month == targetDate month
                if (rt.startDate.getMonth() !== targetDate.getMonth()) {
                    monthlyAmount = 0;
                } else {
                    monthlyAmount = Number(rt.amount);
                }
            }

            if (rt.type === 'INCOME') fixedIncome += monthlyAmount;
            else if (rt.type === 'EXPENSE') fixedExpenses += monthlyAmount;
        }

        // --- VARIABLE Expenses (Predictions) ---
        let variableExpenses = 0;
        let variableExpensesOptimistic = 0;
        let variableExpensesPessimistic = 0;
        
        // Income variable logic (simplified as average of last 3 months if not in recurring)
        // For MVP, we'll assume 0 variable income or rely on recurring.
        // Or fetch average 'INCOME' transactions that are NOT attached to recurring.
        const variableIncome = 0; 

        for (const catId of variableCategoryIds) {
            const pred = await this.predictionService.predictCategoryExpense(userId, catId, targetDate);
            if (pred) {
                // Scenario Adjustment
                let amount = Number(pred.predictedAmount);
                const stdDev = (Number(pred.upperBound) - Number(pred.predictedAmount)); // Approx deviation

                if (scenario === ProjectionScenario.OPTIMISTIC) {
                    amount -= stdDev; // Less expense is optimistic
                } else if (scenario === ProjectionScenario.PESSIMISTIC) {
                    amount += stdDev; // More expense is pessimistic
                }
                
                variableExpenses += amount;
                
                // For scenario bounds in response
                variableExpensesOptimistic += (Number(pred.predictedAmount) - stdDev);
                variableExpensesPessimistic += (Number(pred.predictedAmount) + stdDev);
            }
        }

        // --- Totals ---
        const totalIncome = fixedIncome + variableIncome;
        const totalExpenses = fixedExpenses + variableExpenses;
        const periodBalance = totalIncome - totalExpenses;
        accumulatedBalance += periodBalance;

        // Scenario Bounds for Total Balance
        // Optimistic Balance = Fixed Income - (Variable Optimistic)
        // Pessimistic Balance = Fixed Income - (Variable Pessimistic)
        const optimisticBalance = fixedIncome - variableExpensesOptimistic;
        const pessimisticBalance = fixedIncome - variableExpensesPessimistic;

        projections.push({
            month: monthKey,
            income: {
                fixed: fixedIncome,
                variable: variableIncome,
                total: totalIncome
            },
            expenses: {
                fixed: fixedExpenses,
                variable: variableExpenses,
                total: totalExpenses
            },
            balance: {
                period: periodBalance,
                accumulated: accumulatedBalance
            },
            scenarios: {
                optimistic: accumulatedBalance + (fixedExpenses - variableExpensesOptimistic), // Rough approx accumulation
                pessimistic: accumulatedBalance + (fixedExpenses - variableExpensesPessimistic)
            }
        });
    }

    return {
        initialBalance,
        months,
        scenario,
        data: projections
    };
  }
}
