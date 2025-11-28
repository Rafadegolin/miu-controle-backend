import { PartialType } from '@nestjs/swagger';
import { CreateGoalDto } from './create-goal.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { GoalStatus } from '@prisma/client';

export class UpdateGoalDto extends PartialType(CreateGoalDto) {
  @ApiProperty({
    enum: GoalStatus,
    required: false,
    example: 'ACTIVE',
  })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;
}
