import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsString } from 'class-validator';

/**
 * Plano de meta aprovado pelo usuário (espelha o retorno de
 * PlanningService.calculateGoalPlan). É persistido como JSON em GoalPlan.actionPlan,
 * então TODOS os campos enviados precisam estar declarados aqui (ValidationPipe
 * com whitelist remove os não declarados).
 */
export class SavePlanDto {
  @ApiProperty({ example: 416.67, description: 'Depósito mensal recomendado' })
  @IsNumber()
  monthlyDeposit: number;

  @ApiProperty({ example: 12, description: 'Meses até a meta' })
  @IsNumber()
  months: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  isViable: boolean;

  @ApiProperty({ example: 250.0, description: 'Folga mensal (surplus - depósito)' })
  @IsNumber()
  margin: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  recommendations: string[];

  @ApiProperty({
    type: [Object],
    description: 'Passos do plano de ação ({ title, description, value?, type })',
  })
  @IsArray()
  actionPlan: any[];

  @ApiProperty({ type: [Object], description: 'Cortes sugeridos em categorias não essenciais' })
  @IsArray()
  suggestedCuts: any[];
}
