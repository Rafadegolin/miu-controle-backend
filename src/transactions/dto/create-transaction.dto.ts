import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsArray,
  IsNotEmpty, // <-- ADICIONAR AQUI
  Min,
  MaxLength,
} from 'class-validator';
import {
  TransactionSource,
  TransactionType, // <-- REMOVER CategoryType daqui
} from '@prisma/client';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class CreateTransactionDto {
  @ApiProperty({ example: 'uuid-da-conta' })
  @IsNotEmpty() // <-- ADICIONAR
  @IsString()
  accountId: string;

  @ApiProperty({ example: 'uuid-da-categoria', required: false })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ enum: TransactionType, example: 'EXPENSE' })
  @IsNotEmpty() // <-- JÁ TEM
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 150.5 })
  @IsNotEmpty() // <-- ADICIONAR
  @IsNumber()
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  amount: number;

  @ApiProperty({ example: 'Almoço no restaurante' })
  @Sanitize()
  @IsNotEmpty() // <-- ADICIONAR
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({ example: 'Restaurante Bom Sabor', required: false })
  @Sanitize()
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
  @Sanitize()
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
