import { ApiProperty } from '@nestjs/swagger';

export class ReceiptItemDto {
  @ApiProperty({ example: 'Leite Integral 1L' })
  name: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({ example: 5.99 })
  unitPrice: number;

  @ApiProperty({ example: 11.98 })
  total: number;
}
