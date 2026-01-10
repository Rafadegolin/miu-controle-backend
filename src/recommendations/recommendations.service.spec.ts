import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsService } from './recommendations.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExpenseReducerAnalyzer } from './analyzers/expense-reducer.analyzer';
import { SubscriptionReviewerAnalyzer } from './analyzers/subscription-reviewer.analyzer';
import { BudgetOptimizerAnalyzer } from './analyzers/budget-optimizer.analyzer';
import { OpportunityDetectorAnalyzer } from './analyzers/opportunity-detector.analyzer';
import { RiskAlertAnalyzer } from './analyzers/risk-alert.analyzer';
import { GeminiService } from '../ai/services/gemini.service';
import { OpenAiService } from '../ai/services/openai.service';
import { AiKeyManagerService } from '../ai/services/ai-key-manager.service';
import { AiFeatureType } from '@prisma/client';

const mockPrismaService = {
  recommendation: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  userAiConfig: {
    findUnique: jest.fn(),
  },
};

const mockAnalyzer = {
  analyze: jest.fn().mockResolvedValue([]),
};

const mockGeminiService = {
  enhanceText: jest.fn(),
};

const mockOpenAiService = {
  enhanceText: jest.fn(),
};

const mockAiKeyManagerService = {
  getApiKey: jest.fn(),
};

describe('RecommendationsService', () => {
  let service: RecommendationsService;
  let prisma: PrismaService;
  let aiKeyManager: AiKeyManagerService;
  let geminiService: GeminiService;
  let openAiService: OpenAiService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: GeminiService, useValue: mockGeminiService },
        { provide: OpenAiService, useValue: mockOpenAiService },
        { provide: AiKeyManagerService, useValue: mockAiKeyManagerService },
        { provide: ExpenseReducerAnalyzer, useValue: mockAnalyzer },
        { provide: SubscriptionReviewerAnalyzer, useValue: mockAnalyzer },
        { provide: BudgetOptimizerAnalyzer, useValue: mockAnalyzer },
        { provide: OpportunityDetectorAnalyzer, useValue: mockAnalyzer },
        { provide: RiskAlertAnalyzer, useValue: mockAnalyzer },
      ],
    }).compile();

    service = module.get<RecommendationsService>(RecommendationsService);
    prisma = module.get<PrismaService>(PrismaService);
    aiKeyManager = module.get<AiKeyManagerService>(AiKeyManagerService);
    geminiService = module.get<GeminiService>(GeminiService);
    openAiService = module.get<OpenAiService>(OpenAiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return active recommendations for a user', async () => {
      const userId = 'user-1';
      const mockRecommendations = [{ id: 'rec-1', userId, status: 'ACTIVE' }];
      (prisma.recommendation.findMany as jest.Mock).mockResolvedValue(mockRecommendations);

      const result = await service.findAll(userId);

      expect(result).toEqual(mockRecommendations);
      expect(prisma.recommendation.findMany).toHaveBeenCalledWith({
        where: { userId, status: 'ACTIVE' },
        orderBy: { priority: 'desc' },
      });
    });
  });

  describe('generateRecommendationsForUser', () => {
    it('should generate recommendations without AI if config missing', async () => {
      const userId = 'user-1';
      (prisma.recommendation.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.recommendation.count as jest.Mock).mockResolvedValue(0);
      (mockAiKeyManagerService.getApiKey as jest.Mock).mockRejectedValue(new Error('No config'));

      const mockAnalysisResult = [{
        type: 'EXPENSE_REDUCTION',
        title: 'Reduce spending',
        description: 'Spend less',
        impact: 8,
        difficulty: 2,
        category: 'Food',
      }];
      
      (mockAnalyzer.analyze as jest.Mock).mockResolvedValueOnce(mockAnalysisResult);
      (prisma.recommendation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.recommendation.create as jest.Mock).mockResolvedValue({ id: 'new-rec' });

      await service.generateRecommendationsForUser(userId);

      expect(prisma.recommendation.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          description: 'Spend less', // Original description
        }),
      }));
      expect(mockGeminiService.enhanceText).not.toHaveBeenCalled();
      expect(mockOpenAiService.enhanceText).not.toHaveBeenCalled();
    });

    it('should use Gemini when configured', async () => {
      const userId = 'user-1';
      (prisma.recommendation.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.recommendation.count as jest.Mock).mockResolvedValue(0);
      
      (mockAiKeyManagerService.getApiKey as jest.Mock).mockResolvedValue({
        apiKey: 'gemini-key',
        model: 'gemini-1.5-flash',
        provider: 'GEMINI',
      });
      (mockGeminiService.enhanceText as jest.Mock).mockResolvedValue('Enhanced by Gemini');

      const mockAnalysisResult = [{
        type: 'EXPENSE_REDUCTION',
        title: 'Reduce spending',
        description: 'Spend less',
        impact: 8,
        difficulty: 2,
        category: 'Food',
      }];
      (mockAnalyzer.analyze as jest.Mock).mockResolvedValueOnce(mockAnalysisResult);
      (prisma.recommendation.findFirst as jest.Mock).mockResolvedValue(null);

      await service.generateRecommendationsForUser(userId);

      expect(mockGeminiService.enhanceText).toHaveBeenCalledWith('Spend less', 'gemini-key');
      expect(prisma.recommendation.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          description: 'Enhanced by Gemini',
        }),
      }));
    });

    it('should use OpenAI when configured', async () => {
      const userId = 'user-1';
      (prisma.recommendation.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.recommendation.count as jest.Mock).mockResolvedValue(0);
      
      (mockAiKeyManagerService.getApiKey as jest.Mock).mockResolvedValue({
        apiKey: 'openai-key',
        model: 'gpt-4o-mini',
        provider: 'OPENAI',
      });
      (mockOpenAiService.enhanceText as jest.Mock).mockResolvedValue('Enhanced by OpenAI');

      const mockAnalysisResult = [{
        type: 'EXPENSE_REDUCTION',
        title: 'Reduce spending',
        description: 'Spend less',
        impact: 8,
        difficulty: 2,
        category: 'Food',
      }];
      (mockAnalyzer.analyze as jest.Mock).mockResolvedValueOnce(mockAnalysisResult);
      (prisma.recommendation.findFirst as jest.Mock).mockResolvedValue(null);

      await service.generateRecommendationsForUser(userId);

      expect(mockOpenAiService.enhanceText).toHaveBeenCalledWith('Spend less', 'openai-key', 'gpt-4o-mini');
      expect(prisma.recommendation.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          description: 'Enhanced by OpenAI',
        }),
      }));
    });
  });
});
