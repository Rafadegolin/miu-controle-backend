import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for saving AI configuration
 */
export class SaveAiConfigDto {
  @ApiPropertyOptional({
    description: 'OpenAI API key (will be encrypted)',
    example: 'sk-proj-abc123...',
  })
  @IsOptional()
  @IsString()
  openaiApiKey?: string;

  @ApiPropertyOptional({
    description: 'Gemini API key (will be encrypted)',
    example: 'AIzaSy...',
  })
  @IsOptional()
  @IsString()
  geminiApiKey?: string;

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
    description: 'Model for categorization',
    example: 'gpt-4o-mini',
    default: 'gpt-4o-mini',
  })
  @IsOptional()
  @IsString()
  categorizationModel?: string;

  @ApiPropertyOptional({
    description: 'Model for analytics',
    example: 'gemini-1.5-flash',
    default: 'gemini-1.5-flash',
  })
  @IsOptional()
  @IsString()
  analyticsModel?: string;
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
    description: 'Model for categorization',
    example: 'gpt-4o-mini',
  })
  @IsOptional()
  @IsString()
  categorizationModel?: string;

  @ApiPropertyOptional({
    description: 'Model for analytics',
    example: 'gemini-1.5-flash',
  })
  @IsOptional()
  @IsString()
  analyticsModel?: string;
}

/**
 * DTO for testing API key
 */
export class TestApiKeyDto {
  @ApiPropertyOptional({
    description: 'OpenAI API key to test',
    example: 'sk-proj-abc123...',
  })
  @IsOptional()
  @IsString()
  openaiApiKey?: string;

  @ApiPropertyOptional({
    description: 'Gemini API key to test',
    example: 'AIzaSy...',
  })
  @IsOptional()
  @IsString()
  geminiApiKey?: string;
}
