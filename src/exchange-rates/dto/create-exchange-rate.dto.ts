import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class CreateExchangeRateDto {
  @ApiProperty({ example: 'USD', description: 'Código da moeda de origem' })
  @IsString()
  @IsNotEmpty()
  fromCurrency: string;

  @ApiProperty({ example: 'BRL', description: 'Código da moeda de destino' })
  @IsString()
  @IsNotEmpty()
  toCurrency: string;

  @ApiProperty({ example: 5.25, description: 'Taxa de câmbio' })
  @IsNumber()
  @Min(0.000001)
  rate: number;

  @ApiPropertyOptional({
    example: '2024-11-30',
    description: 'Data da taxa (padrão: hoje)',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}
