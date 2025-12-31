import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for saving AI configuration
 */
export class SaveAiConfigDto {
  @ApiProperty({
    description: 'OpenAI API key (will be encrypted)',
    example: 'sk-proj-abc123...',
  })
  @IsString()
  openaiApiKey: string;

  @ApiPropertyOptional({
    description: 'Enable/disable AI categorization',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isAiEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Monthly token limit (default: 1M tokens)',
    example: 1000000,
    default: 1000000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyTokenLimit?: number;

  @ApiPropertyOptional({
    description: 'Preferred model (default: gpt-4o-mini)',
    example: 'gpt-4o-mini',
    default: 'gpt-4o-mini',
  })
  @IsOptional()
  @IsString()
  preferredModel?: string;
}

/**
 * DTO for updating AI configuration
 */
export class UpdateAiConfigDto {
  @ApiPropertyOptional({
    description: 'Enable/disable AI categorization',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isAiEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Monthly token limit',
    example: 2000000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthlyTokenLimit?: number;

  @ApiPropertyOptional({
    description: 'Preferred model',
    example: 'gpt-4o-mini',
  })
  @IsOptional()
  @IsString()
  preferredModel?: string;
}

/**
 * DTO for testing API key
 */
export class TestApiKeyDto {
  @ApiProperty({
    description: 'OpenAI API key to test',
    example: 'sk-proj-abc123...',
  })
  @IsString()
  openaiApiKey: string;
}
