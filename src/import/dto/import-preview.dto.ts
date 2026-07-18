import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';

export enum ImportFormat {
  OFX = 'OFX',
  CSV = 'CSV',
}

/**
 * Opções enviadas junto com o arquivo (multipart) no preview da importação.
 * Campos de CSV só são exigidos quando format = CSV.
 */
export class ImportPreviewDto {
  @ApiProperty({ enum: ImportFormat, example: 'OFX' })
  @IsEnum(ImportFormat)
  format: ImportFormat;

  // ===== Opções de CSV =====
  @ApiProperty({
    required: false,
    example: ';',
    description: 'Separador de colunas (default ;)',
  })
  @IsOptional()
  @IsString()
  delimiter?: string;

  @ApiProperty({
    required: false,
    example: ',',
    description: 'Separador decimal (default ,)',
  })
  @IsOptional()
  @IsString()
  decimalSeparator?: string;

  @ApiProperty({
    required: false,
    example: 'DD/MM/YYYY',
    description:
      'Formato da data: DD/MM/YYYY | DD-MM-YYYY | YYYY-MM-DD | MM/DD/YYYY',
  })
  @IsOptional()
  @IsString()
  dateFormat?: string;

  @ApiProperty({
    required: false,
    example: true,
    description: 'Primeira linha é cabeçalho (default true)',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasHeader?: boolean;

  @ApiProperty({
    required: false,
    description: 'Coluna da data (nome do cabeçalho ou índice)',
  })
  @ValidateIf((o) => o.format === ImportFormat.CSV)
  @IsNotEmpty({ message: 'dateColumn é obrigatório para CSV' })
  @IsString()
  dateColumn?: string;

  @ApiProperty({
    required: false,
    description: 'Coluna do valor (nome ou índice)',
  })
  @ValidateIf((o) => o.format === ImportFormat.CSV)
  @IsNotEmpty({ message: 'amountColumn é obrigatório para CSV' })
  @IsString()
  amountColumn?: string;

  @ApiProperty({
    required: false,
    description: 'Coluna da descrição (nome ou índice)',
  })
  @ValidateIf((o) => o.format === ImportFormat.CSV)
  @IsNotEmpty({ message: 'descriptionColumn é obrigatório para CSV' })
  @IsString()
  descriptionColumn?: string;

  @ApiProperty({
    required: false,
    description: 'Coluna do tipo C/D (opcional; senão infere pelo sinal)',
  })
  @IsOptional()
  @IsString()
  typeColumn?: string;
}
