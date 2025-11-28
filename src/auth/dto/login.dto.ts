import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SenhaForte@123' })
  @IsString()
  password: string;
}
