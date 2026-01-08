import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export enum ProjectionScenario {
  REALISTIC = 'REALISTIC',
  OPTIMISTIC = 'OPTIMISTIC',
  PESSIMISTIC = 'PESSIMISTIC',
}

export class CashFlowProjectionQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  @Transform(({ value }) => parseInt(value))
  months?: number = 6;

  @IsOptional()
  @IsEnum(ProjectionScenario)
  scenario?: ProjectionScenario = ProjectionScenario.REALISTIC;
}
