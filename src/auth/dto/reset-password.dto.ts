import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Token recebido por email',
  })
  @IsString()
  token: string;

  @ApiProperty({
    example: 'NovaSenha@123',
    minLength: 8,
    description: 'Nova senha forte',
  })
  @IsString()
  @MinLength(8, { message: 'Senha deve ter pelo menos 8 caracteres' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Senha deve conter maiúsculas, minúsculas, números e símbolos',
  })
  newPassword: string;
}
