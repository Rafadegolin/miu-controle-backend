export class PredictionResultDto {
  categoryId: string;
  month: Date;
  predictedAmount: number;
  confidence: number;
  lowerBound: number;
  upperBound: number;
  algorithm: string;
  factors: {
    seasonality: number;
    trend: string;
    historicalAverage: number;
    events?: string[];
  };
}
