import { Test, TestingModule } from '@nestjs/testing';
import { HealthScoreService } from './health-score.service';
import { PrismaService } from '../prisma/prisma.service';
import { AchievementsService } from './achievements.service';
import { AiKeyManagerService } from '../ai/services/ai-key-manager.service';
import { GeminiService } from '../ai/services/gemini.service';
import { OpenAiService } from '../ai/services/openai.service';
import { AiFeatureType } from '@prisma/client';

const mockPrismaService = {
  healthScore: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  transaction: {
    findMany: jest.fn(),
  },
  budget: {
    findMany: jest.fn(),
  },
  goal: {
    findMany: jest.fn(),
  },
  emergencyFund: {
    findUnique: jest.fn(),
  },
};

const mockAchievementsService = {
  checkAchievements: jest.fn(),
};

const mockAiKeyManagerService = {
  getApiKey: jest.fn(),
};

const mockGeminiService = {
  enhanceText: jest.fn(),
};

const mockOpenAiService = {
  enhanceText: jest.fn(),
};

describe('HealthScoreService', () => {
  let service: HealthScoreService;
  let prisma: PrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthScoreService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AchievementsService, useValue: mockAchievementsService },
        { provide: AiKeyManagerService, useValue: mockAiKeyManagerService },
        { provide: GeminiService, useValue: mockGeminiService },
        { provide: OpenAiService, useValue: mockOpenAiService },
      ],
    }).compile();

    service = module.get<HealthScoreService>(HealthScoreService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateUserScore', () => {
    it('should calculate score correctly (scenario with data)', async () => {
      const userId = 'user-1';

      // Mock Consistency (2 days in 30 days) => (2/30)*300 = 20
      (prisma.transaction.findMany as jest.Mock).mockResolvedValueOnce([
        { date: new Date() }, { date: new Date(Date.now() - 86400000) } 
      ]); // 2 days

      // Mock Budgets (1 active) => 200 (placeholder)
      (prisma.budget.findMany as jest.Mock).mockResolvedValueOnce([{ id: 'b1' }]);

      // Mock Goals (50% progress) => 200 * 0.5 = 100
      (prisma.goal.findMany as jest.Mock).mockResolvedValueOnce([
        { targetAmount: { toNumber: () => 100 }, currentAmount: { toNumber: () => 50 } }
      ]);

      // Mock Emergency (6 months covered) => 150
      (prisma.emergencyFund.findUnique as jest.Mock).mockResolvedValueOnce({
        monthsCovered: { toNumber: () => 6 }
      });

      // Mock Diversity (2 income sources) => 100
      (prisma.transaction.findMany as jest.Mock).mockResolvedValueOnce([
        { categoryId: 'cat1' }, { categoryId: 'cat2' }
      ]);

      const score = await service.calculateUserScore(userId);
      
      // Expected: 20 + 200 + 100 + 150 + 100 = 570
      expect(score).toBeCloseTo(570, -1); // Allow slight rounding diff
      expect(prisma.healthScore.upsert).toHaveBeenCalledWith(expect.objectContaining({
        create: expect.objectContaining({ totalScore: expect.any(Number) })
      }));
      expect(mockAchievementsService.checkAchievements).toHaveBeenCalledWith(userId);
    });

    it('should handle zero data gracefully', async () => {
      const userId = 'user-empty';

      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.budget.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.goal.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.emergencyFund.findUnique as jest.Mock).mockResolvedValue(null);
      // Diversity also returns empty from transaction findMany already mocked above if simple mock, 
      // but strictly we mocked `findMany` multiple times. 
      // It will use the last mock implementation if we didn't chain `mockResolvedValueOnce`.
      // Let's reset mocks to be safer or chain `Once` carefully.
      
      jest.clearAllMocks();
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.budget.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.goal.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.emergencyFund.findUnique as jest.Mock).mockResolvedValue(null);

      const score = await service.calculateUserScore(userId);

      // Consistency: 0
      // Budget: 125 (Default neutral)
      // Goals: 0
      // Emergency: 0
      // Diversity: 0
      // Total: 125
      
      expect(score).toBe(125);
    });
  });

  describe('refreshAiInsights', () => {
     it('should generate insights using AI service', async () => {
        const userId = 'user-1';
        (prisma.healthScore.findUnique as jest.Mock).mockResolvedValue({
            totalScore: 400, level: 'ATTENTION', consistencyScore: 50
        });

        (mockAiKeyManagerService.getApiKey as jest.Mock).mockResolvedValue({
            apiKey: 'key', provider: 'OPENAI', model: 'gpt-4o'
        });

        (mockOpenAiService.enhanceText as jest.Mock).mockResolvedValue('Dica de ouro');

        const result = await service.refreshAiInsights(userId);

        expect(result).toEqual({ insight: 'Dica de ouro' });
        expect(prisma.healthScore.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ aiInsights: 'Dica de ouro' })
        }));
     });
  });
});
