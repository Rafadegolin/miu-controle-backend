import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString, IsUUID } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class ExportFiltersDto {
  @ApiPropertyOptional({
    example: '2024-01-01',
    description: 'Data inicial (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2024-12-31',
    description: 'Data final (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    enum: TransactionType,
    description: 'Tipo de transação',
    example: 'EXPENSE',
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({
    example: 'uuid-da-categoria',
    description: 'ID da categoria',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'uuid-da-conta',
    description: 'ID da conta bancária',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
