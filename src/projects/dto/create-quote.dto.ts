import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Sanitize } from '../../common/decorators/sanitize.decorator';

export class CreateQuoteDto {
  @ApiProperty({
    example: 'AutoPeças Centro',
    description: 'Nome do fornecedor',
  })
  @Sanitize()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  supplierName: string;

  @ApiProperty({ example: 450.0, description: 'Preço principal do fornecedor' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Preço deve ser maior que zero' })
  price: number;

  @ApiProperty({
    example: 30.0,
    required: false,
    default: 0,
    description: 'Custos adicionais: frete, instalação, etc.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  additionalCosts?: number;

  @ApiProperty({
    example: 'À vista, desconto de 5% no débito',
    required: false,
  })
  @Sanitize()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
