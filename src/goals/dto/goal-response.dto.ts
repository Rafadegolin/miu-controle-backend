import { ApiProperty } from '@nestjs/swagger';

export class GoalCountDto {
  @ApiProperty({ example: 3, description: 'Número de contribuições' })
  contributions: number;
}

export class GoalResponseDto {
  @ApiProperty({ example: 'uuid-goal' })
  id: string;

  @ApiProperty({ example: 'Viagem para a Europa' })
  name: string;

  @ApiProperty({ example: 'Reserva para férias de 2027', nullable: true })
  description: string | null;

  @ApiProperty({ example: 15000.0 })
  targetAmount: number;

  @ApiProperty({ example: 4200.0 })
  currentAmount: number;

  @ApiProperty({ example: '2027-01-01T00:00:00.000Z', nullable: true })
  targetDate: string | null;

  @ApiProperty({ example: '#10B981' })
  color: string;

  @ApiProperty({ example: '✈️', nullable: true })
  icon: string | null;

  @ApiProperty({ example: 3, description: '1 (maior) a 5 (menor)' })
  priority: number;

  @ApiProperty({
    enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
    example: 'ACTIVE',
  })
  status: string;

  @ApiProperty({
    example: null,
    nullable: true,
    description: 'ID do objetivo pai (hierarquia)',
  })
  parentId: string | null;

  @ApiProperty({ example: 'https://cdn.../goal.png', nullable: true })
  imageUrl: string | null;

  @ApiProperty({
    type: 'array',
    items: { type: 'object' },
    nullable: true,
    description: 'Links de compra associados ao objetivo (array JSON)',
  })
  purchaseLinks: unknown[] | null;

  @ApiProperty({ example: '2026-01-10T00:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-02-20T00:00:00.000Z' })
  updatedAt: string;

  @ApiProperty({ example: null, nullable: true })
  completedAt: string | null;

  // Campos calculados adicionados pelo service
  @ApiProperty({
    example: 28.0,
    description: 'Percentual atingido (currentAmount/targetAmount)',
  })
  percentage: number;

  @ApiProperty({
    example: 10800.0,
    description: 'Valor restante (targetAmount - currentAmount)',
  })
  remaining: number;

  @ApiProperty({ example: false, description: 'true se targetDate já passou' })
  isOverdue: boolean;

  @ApiProperty({
    example: 320,
    nullable: true,
    description: 'Dias restantes até targetDate',
  })
  daysRemaining: number | null;

  @ApiProperty({ type: GoalCountDto })
  _count: GoalCountDto;
}

export class GoalContributionTransactionDto {
  @ApiProperty({ example: 'uuid-transaction' })
  id: string;

  @ApiProperty({ example: 'Aporte mensal', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-02-01T00:00:00.000Z' })
  date: string;
}

export class GoalContributionDto {
  @ApiProperty({ example: 'uuid-contribution' })
  id: string;

  @ApiProperty({ example: 500.0 })
  amount: number;

  @ApiProperty({ example: '2026-02-01T00:00:00.000Z' })
  date: string;

  @ApiProperty({ type: GoalContributionTransactionDto, nullable: true })
  transaction: GoalContributionTransactionDto | null;
}

export class GoalDetailResponseDto extends GoalResponseDto {
  @ApiProperty({
    type: [GoalContributionDto],
    description: 'Contribuições do objetivo (mais recentes primeiro)',
  })
  contributions: GoalContributionDto[];
}
