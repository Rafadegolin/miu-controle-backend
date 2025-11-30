import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ResendVerificationDto {
  @ApiProperty({
    example: 'joao@email.com',
    description: 'Email para reenviar verificação',
  })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;
}
