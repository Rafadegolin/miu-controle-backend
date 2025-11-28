import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
  IsHexColor,
} from 'class-validator';
import { CategoryType } from '@prisma/client';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Academia' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    enum: CategoryType,
    example: 'EXPENSE',
    description: 'Tipo: EXPENSE, INCOME ou TRANSFER',
  })
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiProperty({ example: '#EF4444', required: false })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiProperty({ example: 'dumbbell', required: false })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ example: 'uuid-categoria-pai', required: false })
  @IsOptional()
  @IsString()
  parentId?: string;
}
