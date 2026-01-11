
export class TransactionCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly transactionId: string,
    public readonly type: 'INCOME' | 'EXPENSE',
    public readonly amount: number,
    public readonly date: Date,
  ) {}
}

export class GoalContributedEvent {
  constructor(
    public readonly userId: string,
    public readonly goalId: string,
    public readonly amount: number,
  ) {}
}

export class BudgetReviewEvent {
    constructor(
        public readonly userId: string,
        public readonly month: Date
    ) {}
}
