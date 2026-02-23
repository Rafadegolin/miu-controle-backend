import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsDateString,
  IsString,
  MaxLength,
} from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class ConvertQuoteDto {
  @ApiProperty({
    example: 'uuid-da-conta',
    description: 'ID da conta que será debitada',
  })
  @IsUUID()
  accountId: string;

  @ApiProperty({
    example: 'uuid-da-categoria',
    required: false,
    description: 'ID da categoria para a transação (opcional)',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({
    example: '2026-02-22',
    required: false,
    description: 'Data da compra (padrão: hoje)',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({
    example: 'Compra via projeto Arrumar Carro',
    required: false,
    description: 'Observação adicional para a transação (opcional)',
  })
  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
