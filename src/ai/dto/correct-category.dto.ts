import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for correcting a category prediction
 */
export class CorrectCategoryDto {
  @ApiProperty({
    description: 'ID of the correct category',
    example: 'uuid-123',
  })
  @IsString()
  correctedCategoryId: string;
}
