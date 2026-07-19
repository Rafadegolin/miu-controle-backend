import { ApiProperty } from '@nestjs/swagger';

/**
 * Shape real (flat) do GET /health-score — não há `breakdown` aninhado.
 * Espelha o modelo Prisma `HealthScore`.
 */
export class HealthScoreResponseDto {
  @ApiProperty({ example: 'uuid-health-score' })
  id: string;

  @ApiProperty({ example: 'uuid-user' })
  userId: string;

  @ApiProperty({ example: 720, description: 'Pontuação total (0-1000)' })
  totalScore: number;

  @ApiProperty({ example: 210, description: 'Consistência (0-300)' })
  consistencyScore: number;

  @ApiProperty({ example: 180, description: 'Orçamentos (0-250)' })
  budgetScore: number;

  @ApiProperty({ example: 140, description: 'Metas (0-200)' })
  goalsScore: number;

  @ApiProperty({ example: 110, description: 'Reserva de emergência (0-150)' })
  emergencyScore: number;

  @ApiProperty({ example: 80, description: 'Diversificação (0-100)' })
  diversityScore: number;

  @ApiProperty({
    enum: ['CRITICAL', 'ATTENTION', 'HEALTHY', 'GOOD', 'EXCELLENT'],
    example: 'GOOD',
  })
  level: string;

  @ApiProperty({
    example: 'Você está indo bem! Considere aumentar sua reserva.',
    nullable: true,
    description: 'Insights gerados por IA',
  })
  aiInsights: string | null;

  @ApiProperty({ example: '2026-02-20T10:00:00.000Z', nullable: true })
  lastAiAnalysisAt: string | null;

  @ApiProperty({ example: '2026-02-25T08:30:00.000Z' })
  updatedAt: string;
}
