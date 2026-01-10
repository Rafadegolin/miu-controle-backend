import { RecommendationType } from '@prisma/client';

export interface AnalyzerResult {
  type: RecommendationType;
  title: string;
  description: string;
  impact: number;
  difficulty: number;
  category?: string;
  metadata?: any;
}

export interface Analyzer {
  analyze(userId: string): Promise<AnalyzerResult[]>;
}
