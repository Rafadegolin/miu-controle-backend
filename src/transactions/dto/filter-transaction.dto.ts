import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsString,
  IsUUID,
} from 'class-validator';
import { TransactionType, TransactionStatus } from '@prisma/client';
import { CursorPaginationDto } from '../../common/dto/cursor-pagination.dto';

export class FilterTransactionDto extends CursorPaginationDto {
  @ApiPropertyOptional({
    enum: TransactionType,
    example: 'EXPENSE',
    description: 'Filtrar por tipo de transação',
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({
    example: 'uuid-da-categoria',
    description: 'Filtrar por categoria',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'uuid-da-conta',
    description: 'Filtrar por conta',
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    enum: TransactionStatus,
    example: 'COMPLETED',
    description: 'Filtrar por status',
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

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
    example: 'mercado',
    description: 'Buscar por descrição ou merchant',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
