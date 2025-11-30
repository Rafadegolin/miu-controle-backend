import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyResetTokenDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Token para validar',
  })
  @IsString()
  token: string;
}
