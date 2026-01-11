import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum MissionFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  ONEOFF = 'ONEOFF',
  DYNAMIC = 'DYNAMIC'
}

export class CreateMissionDto {
  @ApiProperty({ example: 'TX_5', description: 'Código único da missão' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'Registro Diário', description: 'Título da missão' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Faça 5 transações', description: 'Descrição da missão' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 100, description: 'XP ao completar' })
  @IsNumber()
  xpReward: number;

  @ApiProperty({ enum: MissionFrequency, example: 'WEEKLY' })
  @IsEnum(MissionFrequency)
  frequency: MissionFrequency;

  @ApiProperty({ example: { type: 'TRANSACTION_COUNT', target: 5 }, description: 'Critério JSON' })
  @IsObject()
  criteria: any;
}
