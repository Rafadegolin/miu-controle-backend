import { Test, TestingModule } from '@nestjs/testing';
import { AiUsageService } from '../../src/ai/services/ai-usage.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('AiUsageService', () => {
  let service: AiUsageService;
  let prisma: PrismaService;

  const mockPrismaService = {
    aiUsageMetric: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    userAiConfig: {
      findUnique: jest.fn(),
    },
    aiCategorizationFeedback: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiUsageService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<AiUsageService>(AiUsageService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('trackUsage', () => {
    it('should track AI usage successfully', async () => {
      mockPrismaService.aiUsageMetric.create.mockResolvedValue({});

      await service.trackUsage(
        'user-1',
        'CATEGORIZATION',
        { prompt_tokens: 500, completion_tokens: 100, total_tokens: 600 },
        'gpt-4o-mini',
        'transaction-1'
      );

      expect(mockPrismaService.aiUsageMetric.create).toHaveBeenCalled();
    });

    it('should handle tracking failure gracefully', async () => {
      mockPrismaService.aiUsageMetric.create.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        service.trackUsage('user-1', 'CATEGORIZATION', {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        }, 'gpt-4o-mini')).resolves.not.toThrow();
    });
  });

  describe('checkMonthlyLimit', () => {
    it('should return true when no limit is set', async () => {
      mockPrismaService.userAiConfig.findUnique.mockResolvedValue(null);

      const result = await service.checkMonthlyLimit('user-1');

      expect(result).toBe(true);
    });
  });

  describe('trackFailure', () => {
    it('should track AI failure', async () => {
      mockPrismaService.aiUsageMetric.create.mockResolvedValue({});

      await service.trackFailure(
        'user-1',
        'CATEGORIZATION',
        'gpt-4o-mini',
        'API key invalid'
      );

      expect(mockPrismaService.aiUsageMetric.create).toHaveBeenCalled();
    });
  });
});
