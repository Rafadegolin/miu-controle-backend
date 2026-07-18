import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { ParsedTransactionDto } from './parsed-transaction.dto';

/**
 * Confirmação da importação: o usuário revisa o preview e envia as transações
 * (possivelmente editadas/filtradas) para persistência em lote.
 */
export class ConfirmImportDto {
  @ApiProperty({
    example: 'uuid-da-conta',
    description: 'Conta de destino dos lançamentos',
  })
  @IsNotEmpty()
  @IsString()
  accountId: string;

  @ApiProperty({ type: [ParsedTransactionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ParsedTransactionDto)
  transactions: ParsedTransactionDto[];
}
