import {
  IsString,
  IsNotEmpty,
  IsUrl,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddPurchaseLinkDto {
  @ApiProperty({
    description: 'Título do link de compra',
    example: 'MacBook Pro M3 - 16GB RAM',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty({ message: 'Título é obrigatório' })
  @MaxLength(200, { message: 'Título deve ter no máximo 200 caracteres' })
  title: string;

  @ApiProperty({
    description: 'URL do produto (HTTPS apenas)',
    example: 'https://www.amazon.com.br/MacBook-Pro-M3/dp/B0ABCDEF',
  })
  @IsUrl(
    {
      protocols: ['https'],
      require_protocol: true,
    },
    { message: 'URL inválida. Use HTTPS' },
  )
  @IsNotEmpty({ message: 'URL é obrigatória' })
  url: string;

  @ApiProperty({
    description: 'Preço do produto',
    example: 12500.0,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Preço deve ser um número' })
  @Min(0, { message: 'Preço não pode ser negativo' })
  price?: number;

  @ApiProperty({
    description: 'Código da moeda (ISO 4217)',
    example: 'BRL',
    default: 'BRL',
    required: false,
    maxLength: 3,
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'Moeda deve ter 3 letras maiúsculas (ex: BRL, USD)',
  })
  currency?: string = 'BRL';

  @ApiProperty({
    description: 'Notas adicionais sobre o link',
    example: 'Aguardar Black Friday para desconto',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Nota deve ter no máximo 500 caracteres' })
  note?: string;
}
