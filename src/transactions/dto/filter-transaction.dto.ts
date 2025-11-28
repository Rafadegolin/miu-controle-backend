import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';
import { CategoryType, TransactionStatus } from '@prisma/client';

export class FilterTransactionDto {
  @ApiPropertyOptional({ enum: CategoryType })
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ example: '2025-11-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-11-30' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({ example: 'restaurante' })
  @IsOptional()
  @IsString()
  search?: string;
}
