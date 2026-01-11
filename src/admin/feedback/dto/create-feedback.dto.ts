import { IsString, IsNotEmpty, IsEnum, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum FeedbackType {
  BUG = 'BUG',
  SUGGESTION = 'SUGGESTION',
  OTHER = 'OTHER'
}

export class CreateFeedbackDto {
  @ApiProperty({ enum: FeedbackType, example: 'BUG' })
  @IsEnum(FeedbackType)
  type: FeedbackType;

  @ApiProperty({ example: 'Erro ao salvar transação', description: 'Título do feedback' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Ao clicar em salvar, ocorre erro 500...', description: 'Descrição detalhada' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ type: [String], required: false, example: ['https://minio.../print.png'] })
  @IsArray()
  @IsOptional()
  attachments?: string[];
}
