import { IsNumber, IsOptional, Max, Min, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CategoryInflationOverride {
    @ApiProperty()
    @IsString()
    categoryId: string;

    @ApiProperty()
    @IsNumber()
    inflationRate: number;
}

import { IsString } from 'class-validator';

export class InflationSimulationDto {
  @ApiProperty({ description: 'Taxa de inflação anual projetada (%)', example: 4.5 })
  @IsNumber()
  @Min(0)
  @Max(1000)
  inflationRate: number;

  @ApiProperty({ description: 'Reajuste salarial anual esperado (%)', example: 5.0 })
  @IsNumber()
  @Min(0)
  @Max(1000)
  salaryAdjustment: number;

  @ApiProperty({ description: 'Período de projeção em meses', default: 12 })
  @IsNumber()
  @IsOptional()
  periodMonths?: number = 12;
  
  // Future: specific category overrides using CategoryInflationOverride
}
