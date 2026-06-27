import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

/**
 * Uma transação extraída de um arquivo (OFX/CSV), antes de ser confirmada
 * pelo usuário. É o item do preview e também o que volta no confirm.
 */
export class ParsedTransactionDto {
  @ApiProperty({ example: '2026-01-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 89.5, description: 'Valor sempre positivo; o tipo define o sinal' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: TransactionType, example: 'EXPENSE' })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 'Compra Supermercado Extra' })
  @IsString()
  description: string;

  @ApiProperty({
    required: false,
    example: 'FITID-202401150001',
    description: 'Identificador externo (ex: FITID do OFX) usado para deduplicação',
  })
  @IsOptional()
  @IsString()
  externalId?: string;
}
