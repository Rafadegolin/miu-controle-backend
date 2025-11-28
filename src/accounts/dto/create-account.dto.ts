import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  MinLength,
  MaxLength,
} from 'class-validator';
import { AccountType } from '@prisma/client';

export class CreateAccountDto {
  @ApiProperty({ example: 'Nubank' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    enum: AccountType,
    example: 'CHECKING',
    description: 'Tipo de conta: CHECKING, SAVINGS, CREDIT_CARD, INVESTMENT',
  })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiProperty({ example: '260', required: false })
  @IsOptional()
  @IsString()
  bankCode?: string;

  @ApiProperty({ example: 1000.0, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  initialBalance?: number;

  @ApiProperty({ example: '#6366F1', required: false })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: 'credit-card', required: false })
  @IsOptional()
  @IsString()
  icon?: string;
}
