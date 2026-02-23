import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class CreateProjectItemDto {
  @ApiProperty({ example: 'Bateria nova', description: 'Nome do item' })
  @Sanitize()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiProperty({
    example: 'Bateria de 60Ah para o modelo 2018',
    required: false,
  })
  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: 1,
    required: false,
    default: 1,
    description: 'Quantidade do item',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  quantity?: number;

  @ApiProperty({
    example: 2,
    required: false,
    default: 3,
    description: 'Prioridade: 1=urgente … 5=baixa',
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;
}
