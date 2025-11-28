import { PartialType } from '@nestjs/swagger';
import { CreateTransactionDto } from './create-transaction.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionStatus } from '@prisma/client';

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {
  @ApiProperty({
    enum: TransactionStatus,
    required: false,
    example: 'COMPLETED',
  })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;
}
