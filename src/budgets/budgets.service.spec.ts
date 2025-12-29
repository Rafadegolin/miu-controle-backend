import { Test, TestingModule } from '@nestjs/testing';
import { BudgetsService } from './budgets.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { BudgetPeriod } from '@prisma/client';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let prisma: PrismaService;

  const mockUserId = 'user-123';
  const mockCategoryId = 'category-456';
  const mockBudgetId = 'budget-789';

  const mockCategory = {
    id: mockCategoryId,
    userId: mockUserId,
    name: 'Alimentação',
    type: 'EXPENSE',
  };

  const mockBudget = {
    id: mockBudgetId,
    userId: mockUserId,
    categoryId: mockCategoryId,
    amount: 1000,
    period: BudgetPeriod.MONTHLY,
    startDate: new Date('2025-01-01'),
    endDate: null,
    alertPercentage: 80,
    createdAt: new Date(),
    category: mockCategory,
  };

  const mockPrismaService = {
    category: {
      findUnique: jest.fn(),
    },
    budget: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    transaction: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create a budget', async () => {
      const createDto = {
        categoryId: mockCategoryId,
        amount: 1000,
        period: BudgetPeriod.MONTHLY,
        startDate: '2025-01-01',
        alertPercentage: 80,
      };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.budget.findFirst.mockResolvedValue(null);
      mockPrismaService.budget.create.mockResolvedValue(mockBudget);

      const result = await service.create(mockUserId, createDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.budget.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if category does not exist', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create(mockUserId, {
          categoryId: 'invalid',
          amount: 1000,
          period: BudgetPeriod.MONTHLY,
          startDate: '2025-01-01',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if category belongs to different user', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        userId: 'different-user',
      });

      await expect(
        service.create(mockUserId, {
          categoryId: mockCategoryId,
          amount: 1000,
          period: BudgetPeriod.MONTHLY,
          startDate: '2025-01-01',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if budget already exists for period', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.budget.findFirst.mockResolvedValue(mockBudget);

      await expect(
        service.create(mockUserId, {
          categoryId: mockCategoryId,
          amount: 1000,
          period: BudgetPeriod.MONTHLY,
          startDate: '2025-01-01',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if endDate is before startDate', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.budget.findFirst.mockResolvedValue(null);

      await expect(
        service.create(mockUserId, {
          categoryId: mockCategoryId,
          amount: 1000,
          period: BudgetPeriod.MONTHLY,
          startDate: '2025-01-15',
          endDate: '2025-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all budgets with spending calculations', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([mockBudget]);
      mockPrismaService.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 750 },
      });

      const result = await service.findAll(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].spent).toBe(750);
      expect(result[0].remaining).toBe(250);
      expect(result[0].percentage).toBeGreaterThan(0);
      expect(result[0].status).toBeDefined();
    });

    it('should filter by period when provided', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([mockBudget]);
      mockPrismaService.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
      });

      await service.findAll(mockUserId, BudgetPeriod.MONTHLY);

      expect(mockPrismaService.budget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
            period: BudgetPeriod.MONTHLY,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return budget with transactions and stats', async () => {
      mockPrismaService.budget.findUnique.mockResolvedValue(mockBudget);
      mockPrismaService.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 600 },
      });
      mockPrismaService.transaction.findMany.mockResolvedValue([]);

      const result = await service.findOne(mockBudgetId, mockUserId);

      expect(result).toBeDefined();
      expect(result.spent).toBe(600);
      expect(result.transactions).toBeDefined();
    });

    it('should throw NotFoundException if budget does not exist', async () => {
      mockPrismaService.budget.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if budget belongs to different user', async () => {
      mockPrismaService.budget.findUnique.mockResolvedValue({
        ...mockBudget,
        userId: 'different-user',
      });

      await expect(
        service.findOne(mockBudgetId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update budget successfully', async () => {
      mockPrismaService.budget.findUnique.mockResolvedValue(mockBudget);
      mockPrismaService.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
      });
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.budget.update.mockResolvedValue({
        ...mockBudget,
        amount: 1500,
      });

      const result = await service.update(mockBudgetId, mockUserId, {
        amount: 1500,
      });

      expect(result.amount).toBe(1500);
    });
  });

  describe('remove', () => {
    it('should delete budget successfully', async () => {
      mockPrismaService.budget.findUnique.mockResolvedValue(mockBudget);
      mockPrismaService.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
      });
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.budget.delete.mockResolvedValue(mockBudget);

      const result = await service.remove(mockBudgetId, mockUserId);

      expect(result.message).toContain('sucesso');
      expect(mockPrismaService.budget.delete).toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    it('should calculate monthly budget summary', async () => {
      mockPrismaService.budget.findMany.mockResolvedValue([mockBudget]);
      mockPrismaService.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 750 },
      });

      const result = await service.getSummary(mockUserId, '2025-01');

      expect(result.totalBudgeted).toBeGreaterThan(0);
      expect(result.totalSpent).toBeGreaterThan(0);
      expect(result.budgets).toBeDefined();
      expect(result.budgets).toHaveLength(1);
    });
  });
});
