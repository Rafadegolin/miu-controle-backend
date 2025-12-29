import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para paginação cursor-based
 * Usado em endpoints que retornam grandes volumes de dados
 */
export class CursorPaginationDto {
  @ApiPropertyOptional({
    description: 'Cursor (ID) do último item da página anterior',
    example: 'uuid-do-ultimo-item',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Quantidade de itens por página',
    example: 50,
    minimum: 1,
    maximum: 100,
    default: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number = 50;
}

/**
 * Resposta padrão de paginação cursor-based
 */
export class CursorPaginationResponse<T> {
  @ApiPropertyOptional({
    description: 'Lista de itens da página atual',
    isArray: true,
  })
  items: T[];

  @ApiPropertyOptional({
    description: 'Cursor para próxima página (null se não houver mais itens)',
    example: 'uuid-do-ultimo-item',
    nullable: true,
  })
  nextCursor: string | null;

  @ApiPropertyOptional({
    description: 'Indica se há mais itens disponíveis',
    example: true,
  })
  hasMore: boolean;

  @ApiPropertyOptional({
    description: 'Total de itens (opcional, pode ser omitido para performance)',
    example: 1523,
    required: false,
  })
  totalCount?: number;

  constructor(
    items: T[],
    nextCursor: string | null,
    hasMore: boolean,
    totalCount?: number,
  ) {
    this.items = items;
    this.nextCursor = nextCursor;
    this.hasMore = hasMore;
    this.totalCount = totalCount;
  }
}
