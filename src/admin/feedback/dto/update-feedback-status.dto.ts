import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum FeedbackStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED'
}

export class UpdateFeedbackStatusDto {
  @ApiProperty({ enum: FeedbackStatus })
  @IsEnum(FeedbackStatus)
  status: FeedbackStatus;

  @ApiProperty({ example: 'Bug corrigido na versão 1.2.1', required: false })
  @IsString()
  @IsOptional()
  adminResponse?: string;
}
