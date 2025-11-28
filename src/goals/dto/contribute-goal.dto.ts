import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsDateString,
  IsString,
  Min,
} from 'class-validator';

export class ContributeGoalDto {
  @ApiProperty({ example: 500.0 })
  @IsNumber()
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  amount: number;

  @ApiProperty({
    example: '2025-11-28',
    required: false,
    description: 'Data da contribuição (padrão: hoje)',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({
    example: 'uuid-transacao',
    required: false,
    description: 'ID da transação relacionada (se houver)',
  })
  @IsOptional()
  @IsString()
  transactionId?: string;
}
