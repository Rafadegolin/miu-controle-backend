import { Test, TestingModule } from '@nestjs/testing';
import { AiCategorizationService } from '../../src/ai/services/ai-categorization.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EncryptionService } from '../../src/common/services/encryption.service';
import { AiUsageService } from '../../src/ai/services/ai-usage.service';
import { ConfigService } from '@nestjs/config';

describe('AiCategorizationService', () => {
  let service: AiCategorizationService;
  let prisma: PrismaService;

  const mockPrismaService = {
    userAiConfig: {
      findUnique: jest.fn(),
    },
    category: {
      findMany: jest.fn(),
    },
    transaction: {
      findMany: jest.fn(),
    },
  };

  const mockEncryptionService = {
    decrypt: jest.fn().mockReturnValue('sk-test-key-12345'),
  };

  const mockAiUsageService = {
    checkMonthlyLimit: jest.fn().mockResolvedValue(true),
    trackUsage: jest.fn(),
    trackFailure: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiCategorizationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EncryptionService, useValue: mockEncryptionService },
        { provide: AiUsageService, useValue: mockAiUsageService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<AiCategorizationService>(AiCategorizationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('categorizeTransaction - Basic Scenarios', () => {
    const mockTransaction = {
      description: 'Supermercado Extra',
      amount: 150.50,
      merchant: 'Extra',
      date: new Date('2025-12-31'),
    };

    it('should return null when AI is not configured', async () => {
      mockPrismaService.userAiConfig.findUnique.mockResolvedValue(null);

      const result = await service.categorizeTransaction('user-1', mockTransaction);

      expect(result.categoryId).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('não configurada');
    });

    it('should return null when AI is disabled', async () => {
      mockPrismaService.userAiConfig.findUnique.mockResolvedValue({
        isAiEnabled: false,
        openaiApiKeyEncrypted: 'encrypted',
      });

      const result = await service.categorizeTransaction('user-1', mockTransaction);

      expect(result.categoryId).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toContain('não configurada');
    });

    it('should return null when monthly limit is exceeded', async () => {
      mockPrismaService.userAiConfig.findUnique.mockResolvedValue({
        isAiEnabled: true,
        openaiApiKeyEncrypted: 'encrypted',
        preferredModel: 'gpt-4o-mini',
      });

      mockAiUsageService.checkMonthlyLimit.mockResolvedValue(false);

      const result = await service.categorizeTransaction('user-1', mockTransaction);

      expect(result.categoryId).toBeNull();
      expect(result.reasoning).toContain('tokens excedido'); // Fixed: check for "tokens excedido"
    });

    it('should return null when user has no categories', async () => {
      mockPrismaService.userAiConfig.findUnique.mockResolvedValue({
        isAiEnabled: true,
        openaiApiKeyEncrypted: 'encrypted',
        preferredModel: 'gpt-4o-mini',
      });

      mockAiUsageService.checkMonthlyLimit.mockResolvedValue(true); // Reset to true!
      mockPrismaService.category.findMany.mockResolvedValue([]);

      const result = await service.categorizeTransaction('user-1', mockTransaction);

      expect(result.categoryId).toBeNull();
      expect(result.reasoning).toContain('cadastradas');
    });
  });
});
