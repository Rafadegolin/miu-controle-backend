import { IsString, IsNotEmpty, IsOptional, IsArray, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBrandDto {
  @ApiProperty({ example: 'Netflix', description: 'Nome da marca' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'netflix', description: 'Slug único da marca' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: 'https://netflix.com', required: false })
  @IsString()
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiProperty({ example: ['netflix', 'nflx'], description: 'Padrões de detecção para transações' })
  @IsArray()
  @IsString({ each: true })
  matchPatterns: string[];

  // LogoUrl is handled via upload or separate field, but usually updated after upload
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  logoUrl?: string;
}
