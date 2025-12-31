/**
 * Constantes de eventos WebSocket
 * Usadas para padronizar os nomes de eventos emitidos pelo servidor
 */
export const WS_EVENTS = {
  // Eventos de Transações
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_UPDATED: 'transaction.updated',
  TRANSACTION_DELETED: 'transaction.deleted',
  
  // Eventos de Saldo
  BALANCE_UPDATED: 'balance.updated',
  
  // Eventos de Notificações
  NOTIFICATION_NEW: 'notification.new',
  
  // Eventos de Orçamentos
  BUDGET_ALERT: 'budget.alert',
  
  // Eventos de Metas
  GOAL_MILESTONE: 'goal.milestone',
} as const;

export type WsEventType = typeof WS_EVENTS[keyof typeof WS_EVENTS];
