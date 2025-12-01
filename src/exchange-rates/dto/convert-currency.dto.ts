import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class ConvertCurrencyDto {
  @ApiProperty({ example: 100.0, description: 'Valor a converter' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'USD', description: 'Moeda de origem' })
  @IsString()
  @IsNotEmpty()
  fromCurrency: string;

  @ApiProperty({ example: 'BRL', description: 'Moeda de destino' })
  @IsString()
  @IsNotEmpty()
  toCurrency: string;
}
