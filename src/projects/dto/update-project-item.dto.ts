import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ProjectItemStatus } from '@prisma/client';
import { CreateProjectItemDto } from './create-project-item.dto';

export class UpdateProjectItemDto extends PartialType(CreateProjectItemDto) {
  @ApiProperty({
    enum: ProjectItemStatus,
    required: false,
    description: 'Novo status do item (use convert para marcar como PURCHASED)',
  })
  @IsOptional()
  @IsEnum(ProjectItemStatus)
  status?: ProjectItemStatus;
}
