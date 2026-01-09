import { IsEnum, IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ScenarioType {
  BIG_PURCHASE = 'BIG_PURCHASE',
  INCOME_LOSS = 'INCOME_LOSS',
  EMERGENCY_EXPENSE = 'EMERGENCY_EXPENSE',
  NEW_RECURRING = 'NEW_RECURRING',
  DEBT_PAYMENT = 'DEBT_PAYMENT'
}

export class SimulateScenarioDto {
  @ApiProperty({ enum: ScenarioType })
  @IsEnum(ScenarioType)
  type: ScenarioType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  paymentMethod?: string; // 'CASH', 'CREDIT', 'LOAN'

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  installments?: number;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string; // For recurring scenarios

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
