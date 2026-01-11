import { IsString, IsOptional, IsBoolean, IsIn, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteOnboardingDto {
  @ApiProperty({ example: 'neon', description: 'Tema escolhido' })
  @IsString()
  @IsOptional()
  theme?: string;

  @ApiProperty({ example: 'Gabriel Silva', description: 'Nome de exibição' })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiProperty({ example: 2500, description: 'Renda mensal estimada' })
  @IsNumber()
  @IsOptional()
  monthlyIncome?: number;

  @ApiProperty({ example: 'https://bucket-url/avatar.png', description: 'URL do avatar' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiProperty({ example: 'pt-BR', description: 'Idioma escolhido' })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({ example: 'BRL', description: 'Moeda preferida' })
  @IsString()
  @IsOptional()
  preferredCurrency?: string;

  @ApiProperty({ example: true, description: 'Ativar IA' })
  @IsBoolean()
  @IsOptional()
  isAiEnabled?: boolean;

  @ApiProperty({ example: 'investor', description: 'Personalidade da IA: conservative, investor, educator' })
  @IsString()
  @IsOptional()
  @IsIn(['conservative', 'investor', 'educator'])
  aiPersonality?: string;
  
  // Optional: Initial Goal or Income Amount could be passed here if handled by service directly
  // But usually step-by-step saves intermediate data or creates resources via specific endpoints (like /goals).
  // For simplicity, let's assume specific resources are created via their own modules during the onboarding steps,
  // and this endpoint finalizes the User state.
}
