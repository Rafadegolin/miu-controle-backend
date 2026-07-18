import { ApiProperty } from '@nestjs/swagger';
import { BudgetStatus } from '../../common/enums/budget-status.enum';

export class BudgetCategoryDto {
  @ApiProperty({ example: 'uuid-category' })
  id: string;

  @ApiProperty({ example: 'Alimentação' })
  name: string;

  @ApiProperty({ enum: ['INCOME', 'EXPENSE'], example: 'EXPENSE' })
  type: string;

  @ApiProperty({ example: '#F59E0B' })
  color: string;

  @ApiProperty({ example: '🍔', nullable: true })
  icon: string | null;
}

export class BudgetResponseDto {
  @ApiProperty({ example: 'uuid-budget' })
  id: string;

  @ApiProperty({ example: 'uuid-category' })
  categoryId: string;

  @ApiProperty({ example: 1000.0 })
  amount: number;

  @ApiProperty({
    enum: ['MONTHLY', 'WEEKLY', 'YEARLY'],
    example: 'MONTHLY',
  })
  period: string;

  @ApiProperty({ example: '2026-02-01T00:00:00.000Z' })
  startDate: string;

  @ApiProperty({ example: '2026-02-28T23:59:59.000Z', nullable: true })
  endDate: string | null;

  @ApiProperty({
    example: 80,
    description: 'Percentual de gasto a partir do qual o status vira WARNING',
  })
  alertPercentage: number;

  @ApiProperty({ type: BudgetCategoryDto })
  category: BudgetCategoryDto;

  @ApiProperty({ example: 750.0, description: 'Total gasto no período' })
  spent: number;

  @ApiProperty({
    example: 250.0,
    description: 'Valor restante (amount - spent)',
  })
  remaining: number;

  @ApiProperty({ example: 75.0, description: 'Percentual gasto (0-…)' })
  percentage: number;

  @ApiProperty({
    enum: BudgetStatus,
    example: BudgetStatus.OK,
    description:
      'OK: dentro do orçamento; WARNING: atingiu o alertPercentage; EXCEEDED: estourou (>= 100%)',
  })
  status: BudgetStatus;
}

export class BudgetTransactionDto {
  @ApiProperty({ example: 'uuid-transaction' })
  id: string;

  @ApiProperty({ example: 89.9 })
  amount: number;

  @ApiProperty({ example: 'Almoço', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-02-25T00:00:00.000Z' })
  date: string;
}

export class BudgetDetailResponseDto extends BudgetResponseDto {
  @ApiProperty({
    type: [BudgetTransactionDto],
    description: 'Últimas transações da categoria no período (até 20)',
  })
  transactions: BudgetTransactionDto[];
}
