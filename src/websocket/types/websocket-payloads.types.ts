/**
 * Interfaces TypeScript para payloads de eventos WebSocket
 */

export interface TransactionCreatedPayload {
  transactionId: string;
  accountId: string;
  categoryId?: string;
  type: string;
  amount: number;
  description: string;
  date: Date;
}

export interface TransactionUpdatedPayload {
  transactionId: string;
  accountId: string;
  categoryId?: string;
  type: string;
  amount: number;
  description: string;
  date: Date;
}

export interface TransactionDeletedPayload {
  transactionId: string;
  accountId: string;
}

export interface BalanceUpdatedPayload {
  accountId: string;
  previousBalance: number;
  newBalance: number;
  difference: number;
}

export interface NotificationPayload {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
}

export interface BudgetAlertPayload {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  spent: number;
  limit: number;
  percentage: number;
  alertType: 'WARNING' | 'EXCEEDED';
}

export interface GoalMilestonePayload {
  goalId: string;
  goalName: string;
  currentAmount: number;
  targetAmount: number;
  percentage: number;
  milestone: 25 | 50 | 75 | 100;
}
