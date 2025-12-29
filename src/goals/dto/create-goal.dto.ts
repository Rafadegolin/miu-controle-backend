import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class CreateGoalDto {
  @ApiProperty({ example: 'Viagem para Europa' })
  @Sanitize()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    example: 'Guardar para viagem de férias em julho',
    required: false,
  })
  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 15000.0 })
  @IsNumber()
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  targetAmount: number;

  @ApiProperty({
    example: '2026-07-01',
    required: false,
    description: 'Data objetivo (opcional)',
  })
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiProperty({ example: '#10B981', required: false, default: '#10B981' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: 'plane', required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({
    example: 1,
    required: false,
    description: 'Prioridade: 1 (alta) a 5 (baixa)',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;
}
