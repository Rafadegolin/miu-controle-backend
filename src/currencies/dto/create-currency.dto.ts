import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CreateCurrencyDto {
  @ApiProperty({ example: 'USD', description: 'Código ISO 4217 (3 letras)' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 3)
  code: string;

  @ApiProperty({ example: 'Dólar Americano' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '$' })
  @IsString()
  @IsNotEmpty()
  symbol: string;
}
