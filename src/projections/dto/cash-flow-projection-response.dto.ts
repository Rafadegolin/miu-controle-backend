export class MonthlyProjectionDto {
  month: string; // YYYY-MM
  income: {
    fixed: number;
    variable: number;
    total: number;
  };
  expenses: {
    fixed: number;
    variable: number;
    total: number;
  };
  balance: {
    period: number; // Income - Expense this month
    accumulated: number; // Previous Balance + Period Balance
  };
  scenarios?: {
    optimistic: number;
    pessimistic: number;
  };
}

export class CashFlowProjectionResponseDto {
  initialBalance: number;
  months: number;
  scenario: string;
  data: MonthlyProjectionDto[];
}
