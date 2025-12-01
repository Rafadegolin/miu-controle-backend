import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { RecurrenceFrequency, TransactionType } from '@prisma/client';

export class CreateRecurringTransactionDto {
  @ApiProperty({ example: 'uuid-da-conta' })
  @IsString()
  accountId: string;

  @ApiPropertyOptional({ example: 'uuid-da-categoria' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ enum: TransactionType, example: 'EXPENSE' })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 1500.0 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'Aluguel mensal' })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiPropertyOptional({ example: 'Imobiliária XYZ' })
  @IsOptional()
  @IsString()
  merchant?: string;

  @ApiProperty({
    enum: RecurrenceFrequency,
    example: 'MONTHLY',
    description: 'Frequência de recorrência',
  })
  @IsEnum(RecurrenceFrequency)
  frequency: RecurrenceFrequency;

  @ApiPropertyOptional({
    example: 1,
    description: 'Intervalo (a cada X dias/semanas/meses/anos)',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  interval?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'Dia do mês (1-31) para MONTHLY ou YEARLY',
    minimum: 1,
    maximum: 31,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Dia da semana (0-6, 0=Domingo) para WEEKLY',
    minimum: 0,
    maximum: 6,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiProperty({
    example: '2024-01-01',
    description: 'Data de início da recorrência',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({
    example: '2024-12-31',
    description: 'Data final da recorrência (null = sem fim)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Criar transações automaticamente',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  autoCreate?: boolean;

  @ApiPropertyOptional({ example: ['fixo', 'mensal'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'Vence todo dia 5' })
  @IsOptional()
  @IsString()
  notes?: string;
}
