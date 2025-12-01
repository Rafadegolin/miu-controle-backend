import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class MarkAsReadDto {
  @ApiProperty({
    example: ['uuid-1', 'uuid-2'],
    description: 'IDs das notificações para marcar como lidas',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];
}
