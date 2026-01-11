import { IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOnboardingStepDto {
  @ApiProperty({ example: 2, description: 'Passo atual do onboarding (0-6)' })
  @IsInt()
  @Min(0)
  @Max(6) // Update max if needed
  step: number;
}
