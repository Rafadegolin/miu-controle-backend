import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'joao@email.com',
    description: 'Email da conta para recuperação',
  })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;
}
