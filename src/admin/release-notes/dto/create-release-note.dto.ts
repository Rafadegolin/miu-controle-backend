import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReleaseNoteDto {
  @ApiProperty({ example: '1.2.0', description: 'Versão da release' })
  @IsString()
  @IsNotEmpty()
  version: string;

  @ApiProperty({ example: 'Novas funcionalidades de IA', description: 'Título da nota' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Agora você pode usar a IA para...', description: 'Conteúdo em Markdown' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: true, description: 'Se a nota deve ser exibida imediatamente' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
