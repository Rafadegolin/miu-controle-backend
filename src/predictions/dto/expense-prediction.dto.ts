import { IsString, IsNotEmpty, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ExpensePredictionDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  month: string; // YYYY-MM-DD (typically first day of month)
}
