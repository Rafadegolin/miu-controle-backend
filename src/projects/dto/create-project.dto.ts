import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsHexColor,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Arrumar Carro', description: 'Nome do projeto' })
  @Sanitize()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'Revisão completa do veículo antes da viagem',
    required: false,
  })
  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: 1500.0,
    required: false,
    description: 'Orçamento máximo total estimado (opcional)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  totalBudget?: number;

  @ApiProperty({
    example: '2026-03-15',
    required: false,
    description: 'Prazo limite para concluir o projeto',
  })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiProperty({ example: '#6366F1', required: false, default: '#6366F1' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiProperty({ example: 'car', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;
}
