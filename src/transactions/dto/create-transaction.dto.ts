import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsArray,
  Min,
  MaxLength,
} from 'class-validator';
import { CategoryType, TransactionSource } from '@prisma/client';

export class CreateTransactionDto {
  @ApiProperty({ example: 'uuid-da-conta' })
  @IsString()
  accountId: string;

  @ApiProperty({ example: 'uuid-da-categoria', required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({
    enum: CategoryType,
    example: 'EXPENSE',
    description: 'EXPENSE, INCOME ou TRANSFER',
  })
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiProperty({ example: 150.5 })
  @IsNumber()
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  amount: number;

  @ApiProperty({ example: 'Almoço no restaurante' })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({ example: 'Restaurante Bom Sabor', required: false })
  @IsOptional()
  @IsString()
  merchant?: string;

  @ApiProperty({ example: '2025-11-28', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiProperty({ example: 'MONTHLY', required: false })
  @IsOptional()
  @IsString()
  recurrencePattern?: string;

  @ApiProperty({ example: ['alimentação', 'restaurante'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ example: 'Reunião com cliente', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    example: 'MANUAL',
    required: false,
    enum: TransactionSource,
    default: 'MANUAL',
  })
  @IsOptional()
  @IsEnum(TransactionSource)
  source?: TransactionSource;
}
