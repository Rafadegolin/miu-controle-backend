import { ApiProperty } from '@nestjs/swagger';

// ==================== ACCOUNT SUMMARY ====================
export class AccountSummaryItemDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'Conta Corrente' })
  name: string;

  @ApiProperty({ example: 5000.5 })
  currentBalance: number;

  @ApiProperty({ example: 'CHECKING', enum: ['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT'] })
  type: string;

  @ApiProperty({ example: 'BRL' })
  currency: string;

  @ApiProperty({ example: '#6366F1' })
  color: string;

  @ApiProperty({ example: '💳', required: false })
  icon?: string;
}

export class AccountsSummaryDto {
  @ApiProperty({ example: 15000.75 })
  totalBalance: number;

  @ApiProperty({ type: [AccountSummaryItemDto] })
  accounts: AccountSummaryItemDto[];

  @ApiProperty({ example: 3 })
  activeAccountsCount: number;
}

// ==================== CURRENT MONTH SUMMARY ====================
export class MonthComparisonDto {
  @ApiProperty({ example: 15.5, description: 'Percentage change from last month' })
  incomeChange: number;

  @ApiProperty({ example: -10.2, description: 'Percentage change from last month' })
  expenseChange: number;

  @ApiProperty({ example: 35.8, description: 'Percentage change from last month' })
  balanceChange: number;
}

export class CurrentMonthSummaryDto {
  @ApiProperty({ example: 5000.0 })
  income: number;

  @ApiProperty({ example: 3500.0 })
  expense: number;

  @ApiProperty({ example: 1500.0 })
  balance: number;

  @ApiProperty({ example: 45 })
  transactionCount: number;

  @ApiProperty({ example: 116.67, description: 'Average daily expense' })
  avgDailyExpense: number;

  @ApiProperty({ type: MonthComparisonDto })
  comparisonWithLastMonth: MonthComparisonDto;
}

// ==================== GOALS ====================
export class GoalItemDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'Viagem para Europa' })
  name: string;

  @ApiProperty({ example: 10000.0 })
  targetAmount: number;

  @ApiProperty({ example: 7500.0 })
  currentAmount: number;

  @ApiProperty({ example: 75.0, description: 'Progress percentage' })
  progress: number;

  @ApiProperty({ example: '2025-12-31T00:00:00Z', required: false })
  targetDate?: Date;

  @ApiProperty({ example: 180, required: false, description: 'Days remaining until target date' })
  daysRemaining?: number;

  @ApiProperty({ example: '#10B981' })
  color: string;

  @ApiProperty({ example: '✈️', required: false })
  icon?: string;

  @ApiProperty({ example: 'ACTIVE', enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'] })
  status: string;
}

export class GoalsSummaryDto {
  @ApiProperty({ type: [GoalItemDto] })
  active: GoalItemDto[];

  @ApiProperty({ type: [GoalItemDto], description: 'Goals with progress > 80%' })
  nearCompletion: GoalItemDto[];

  @ApiProperty({ example: 5 })
  totalActiveGoals: number;
}

// ==================== BUDGETS ====================
export class BudgetItemDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'Alimentação' })
  categoryName: string;

  @ApiProperty({ example: 1000.0 })
  amount: number;

  @ApiProperty({ example: 750.0 })
  spent: number;

  @ApiProperty({ example: 75.0 })
  percentage: number;

  @ApiProperty({ example: 'ok', enum: ['ok', 'warning', 'exceeded'], description: 'ok: < 80%, warning: 80-100%, exceeded: > 100%' })
  status: string;

  @ApiProperty({ example: '#94A3B8' })
  categoryColor: string;

  @ApiProperty({ example: '🍔', required: false })
  categoryIcon?: string;
}

export class BudgetsSummaryDto {
  @ApiProperty({ type: [BudgetItemDto] })
  items: BudgetItemDto[];

  @ApiProperty({ type: [BudgetItemDto], description: 'Budgets with percentage > 100%' })
  overBudget: BudgetItemDto[];

  @ApiProperty({ type: [BudgetItemDto], description: 'Budgets with percentage between 80-100%' })
  nearLimit: BudgetItemDto[];

  @ApiProperty({ example: 8 })
  totalBudgets: number;
}

// ==================== RECURRING TRANSACTIONS ====================
export class UpcomingRecurringDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'Netflix Subscription' })
  description: string;

  @ApiProperty({ example: 'EXPENSE', enum: ['INCOME', 'EXPENSE'] })
  type: string;

  @ApiProperty({ example: 49.9 })
  amount: number;

  @ApiProperty({ example: '2025-01-15T00:00:00Z' })
  nextOccurrence: Date;

  @ApiProperty({ example: 5, description: 'Days until next occurrence' })
  daysUntil: number;

  @ApiProperty({ example: 'MONTHLY', enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] })
  frequency: string;

  @ApiProperty({ example: 'Conta Corrente' })
  accountName: string;
}

// ==================== NOTIFICATIONS ====================
export class NotificationItemDto {
  @ApiProperty({ example: 'uuid-123' })
  id: string;

  @ApiProperty({ example: 'BUDGET_ALERT', enum: ['BUDGET_ALERT', 'BUDGET_EXCEEDED', 'GOAL_ACHIEVED', 'GOAL_MILESTONE', 'BILL_DUE', 'SYSTEM'] })
  type: string;

  @ApiProperty({ example: 'Orçamento de Alimentação' })
  title: string;

  @ApiProperty({ example: 'Você já gastou 80% do orçamento deste mês' })
  message: string;

  @ApiProperty({ example: false })
  read: boolean;

  @ApiProperty({ example: '2025-01-10T10:30:00Z' })
  createdAt: Date;
}

export class NotificationsSummaryDto {
  @ApiProperty({ example: 5 })
  unreadCount: number;

  @ApiProperty({ type: [NotificationItemDto], description: 'Last 5 notifications' })
  recent: NotificationItemDto[];
}

// ==================== IMPORTANT DATES ====================
export class ImportantDateDto {
  @ApiProperty({ example: 'recurring', enum: ['recurring', 'goal', 'budget'] })
  type: string;

  @ApiProperty({ example: 'Netflix Subscription' })
  title: string;

  @ApiProperty({ example: '2025-01-15T00:00:00Z' })
  date: Date;

  @ApiProperty({ example: 5 })
  daysUntil: number;

  @ApiProperty({ example: 'uuid-123' })
  referenceId: string;
}

// ==================== INSIGHTS ====================
export class InsightDto {
  @ApiProperty({ example: 'warning', enum: ['warning', 'info', 'success', 'error'] })
  type: string;

  @ApiProperty({ example: 'Gastos em Alta' })
  title: string;

  @ApiProperty({ example: 'Seus gastos aumentaram 15% em relação ao mês anterior' })
  message: string;

  @ApiProperty({ example: '📈' })
  icon: string;
}

// ==================== MAIN DASHBOARD RESPONSE ====================
export class DashboardResponseDto {
  @ApiProperty({ type: AccountsSummaryDto })
  accountsSummary: AccountsSummaryDto;

  @ApiProperty({ type: CurrentMonthSummaryDto })
  currentMonth: CurrentMonthSummaryDto;

  @ApiProperty({ type: GoalsSummaryDto })
  goals: GoalsSummaryDto;

  @ApiProperty({ type: BudgetsSummaryDto })
  budgets: BudgetsSummaryDto;

  @ApiProperty({ type: [UpcomingRecurringDto], description: 'Next 7 days upcoming recurring transactions' })
  upcomingRecurring: UpcomingRecurringDto[];

  @ApiProperty({ type: NotificationsSummaryDto })
  notifications: NotificationsSummaryDto;

  @ApiProperty({ type: [ImportantDateDto], description: 'Next 30 days important dates' })
  importantDates: ImportantDateDto[];

  @ApiProperty({ type: [InsightDto] })
  insights: InsightDto[];

  @ApiProperty({ example: '2025-01-10T12:00:00Z' })
  generatedAt: Date;
}
