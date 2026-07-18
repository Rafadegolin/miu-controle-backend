/**
 * Status de um orçamento em relação ao valor gasto no período.
 *
 * Fonte única de verdade para o casing e para a regra de cálculo — usada tanto
 * em `BudgetsService` (GET /budgets) quanto em `DashboardService` (GET /dashboard/home),
 * evitando divergência de casing/threshold entre os dois endpoints.
 */
export enum BudgetStatus {
  OK = 'OK', // Verde — dentro do orçamento
  WARNING = 'WARNING', // Amarelo — atingiu o limite de alerta do orçamento
  EXCEEDED = 'EXCEEDED', // Vermelho — estourou o orçamento
}

/**
 * Calcula o status do orçamento a partir do percentual gasto e do limite de
 * alerta configurado em cada orçamento (`alertPercentage`).
 */
export function computeBudgetStatus(
  percentage: number,
  alertPercentage: number,
): BudgetStatus {
  if (percentage >= 100) return BudgetStatus.EXCEEDED;
  if (percentage >= alertPercentage) return BudgetStatus.WARNING;
  return BudgetStatus.OK;
}
