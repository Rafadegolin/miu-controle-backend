import { PartialType } from '@nestjs/swagger';
import { CreateAccountDto } from './create-account.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAccountDto extends PartialType(CreateAccountDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
