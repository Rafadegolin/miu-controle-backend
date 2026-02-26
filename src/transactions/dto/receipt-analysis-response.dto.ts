import { ApiProperty } from '@nestjs/swagger';
import { ReceiptItemDto } from './receipt-item.dto';

export class ReceiptPreviewDto {
  @ApiProperty({ example: 'Supermercado Extra', nullable: true })
  description: string | null;

  @ApiProperty({ example: 89.5, nullable: true })
  amount: number | null;

  @ApiProperty({ enum: ['EXPENSE', 'INCOME'], example: 'EXPENSE' })
  type: 'EXPENSE' | 'INCOME';

  @ApiProperty({ example: '2026-02-25', nullable: true })
  date: string | null;

  @ApiProperty({ example: 'Extra Hipermercado LTDA', nullable: true })
  merchant: string | null;

  @ApiProperty({ example: 'uuid-da-categoria-alimentacao', nullable: true })
  categoryId: string | null;

  @ApiProperty({ example: 'Alimentação', nullable: true })
  categoryName: string | null;

  @ApiProperty({
    example: 0.94,
    description: 'Confiança da extração (0.0 a 1.0)',
  })
  confidence: number;

  @ApiProperty({
    type: [ReceiptItemDto],
    description: 'Itens extraídos do cupom',
  })
  items: ReceiptItemDto[];

  @ApiProperty({
    example: 'CUPOM FISCAL SAT ... EXTRA HIPERMERCADO ...',
    nullable: true,
    description: 'Texto bruto extraído da imagem',
  })
  rawText: string | null;
}

export class ReceiptAnalysisResponseDto {
  @ApiProperty({ type: ReceiptPreviewDto })
  preview: ReceiptPreviewDto;

  @ApiProperty({
    example: 'gemini-2.5-flash',
    description: 'Modelo de IA utilizado',
  })
  aiUsed: string;

  @ApiProperty({
    example: 1842,
    description: 'Tempo de processamento em milissegundos',
  })
  processingMs: number;
}
