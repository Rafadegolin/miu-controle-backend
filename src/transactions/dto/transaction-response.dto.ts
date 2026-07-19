import { ApiProperty } from '@nestjs/swagger';

export class TransactionBrandDto {
  @ApiProperty({ example: 'uuid-brand' })
  id: string;

  @ApiProperty({ example: 'Netflix' })
  name: string;

  @ApiProperty({ example: 'https://cdn.../netflix.png', nullable: true })
  logoUrl: string | null;

  @ApiProperty({ example: 'netflix' })
  slug: string;
}

export class TransactionCategoryDto {
  @ApiProperty({ example: 'uuid-category' })
  id: string;

  @ApiProperty({ example: 'Alimentação' })
  name: string;

  @ApiProperty({ example: '#F59E0B' })
  color: string;

  @ApiProperty({ example: '🍔', nullable: true })
  icon: string | null;

  @ApiProperty({ enum: ['INCOME', 'EXPENSE'], example: 'EXPENSE' })
  type: string;
}

export class TransactionAccountDto {
  @ApiProperty({ example: 'uuid-account' })
  id: string;

  @ApiProperty({ example: 'Conta Corrente' })
  name: string;

  @ApiProperty({
    enum: ['CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT'],
    example: 'CHECKING',
  })
  type: string;

  @ApiProperty({ example: '#3B82F6', nullable: true })
  color: string | null;
}

export class TransactionItemDto {
  @ApiProperty({ example: 'uuid-transaction' })
  id: string;

  @ApiProperty({ example: 89.9 })
  amount: number;

  @ApiProperty({ example: 'Almoço', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'Restaurante X', nullable: true })
  merchant: string | null;

  @ApiProperty({ type: TransactionBrandDto, nullable: true })
  brand: TransactionBrandDto | null;

  @ApiProperty({ example: '2026-02-25T00:00:00.000Z' })
  date: string;

  @ApiProperty({ enum: ['INCOME', 'EXPENSE'], example: 'EXPENSE' })
  type: string;

  @ApiProperty({
    enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
    example: 'COMPLETED',
  })
  status: string;

  @ApiProperty({ type: [String], example: ['viagem', 'reembolsável'] })
  tags: string[];

  @ApiProperty({ example: 'Observação livre', nullable: true })
  notes: string | null;

  @ApiProperty({ example: '2026-02-25T12:34:56.000Z' })
  createdAt: string;

  @ApiProperty({ type: TransactionCategoryDto, nullable: true })
  category: TransactionCategoryDto | null;

  @ApiProperty({ type: TransactionAccountDto, nullable: true })
  account: TransactionAccountDto | null;
}

export class TransactionListResponseDto {
  @ApiProperty({ type: [TransactionItemDto] })
  items: TransactionItemDto[];

  @ApiProperty({
    example: 'uuid-da-ultima-transacao',
    nullable: true,
    description: 'Cursor para a próxima página (paginação por cursor)',
  })
  nextCursor: string | null;

  @ApiProperty({
    example: true,
    description: 'Indica se há mais itens além desta página',
  })
  hasMore: boolean;
}
