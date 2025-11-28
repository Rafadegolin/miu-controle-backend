import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { BudgetPeriod } from '@prisma/client';

export class CreateBudgetDto {
  @ApiProperty({ example: 'cat-alimentacao' })
  @IsString()
  categoryId: string;

  @ApiProperty({ example: 1500.0 })
  @IsNumber()
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  amount: number;

  @ApiProperty({
    enum: BudgetPeriod,
    example: 'MONTHLY',
    description: 'Período: MONTHLY, WEEKLY ou YEARLY',
    default: 'MONTHLY',
  })
  @IsEnum(BudgetPeriod)
  period: BudgetPeriod;

  @ApiProperty({
    example: '2025-11-01',
    description: 'Data de início do orçamento',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    example: '2025-11-30',
    required: false,
    description: 'Data de fim (opcional, para orçamentos temporários)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    example: 80,
    required: false,
    description: 'Porcentagem para alerta (padrão: 80%)',
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  alertPercentage?: number;
}
