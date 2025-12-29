import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { TransactionType, CategoryType } from '@prisma/client';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: PrismaService;

  const mockUserId = 'user-123';
  const mockAccountId = 'account-456';
  const mockCategoryId = 'category-789';

  const mockAccount = {
    id: mockAccountId,
    userId: mockUserId,
    currentBalance: 1000,
  };

  const mockCategory = {
    id: mockCategoryId,
    name: 'Alimentação',
    type: CategoryType.EXPENSE,
  };

  const mockTransaction = {
    id: 'transaction-123',
    userId: mockUserId,
    accountId: mockAccountId,
    categoryId: mockCategoryId,
    type: TransactionType.EXPENSE,
    amount: 50,
    description: 'Almoço',
    date: new Date(),
    status: 'COMPLETED',
    category: mockCategory,
    account: mockAccount,
  };

  const mockPrismaService = {
    account: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create a transaction', async () => {
      const createDto = {
        accountId: mockAccountId,
        categoryId: mockCategoryId,
        type: TransactionType.EXPENSE,
        amount: 100,
        description: 'Compras',
        date: new Date().toISOString(),
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.transaction.create.mockResolvedValue(mockTransaction);

      const result = await service.create(mockUserId, createDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.transaction.create).toHaveBeenCalled();
      expect(mockPrismaService.account.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if account does not exist', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(
        service.create(mockUserId, {
          accountId: 'invalid',
          type: TransactionType.EXPENSE,
          amount: 100,
          description: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if account belongs to different user', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        ...mockAccount,
        userId: 'different-user',
      });

      await expect(
        service.create(mockUserId, {
          accountId: mockAccountId,
          type: TransactionType.EXPENSE,
          amount: 100,
          description: 'Test',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if category type does not match transaction type', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        type: CategoryType.INCOME,
      });

      await expect(
        service.create(mockUserId, {
          accountId: mockAccountId,
          categoryId: mockCategoryId,
          type: TransactionType.EXPENSE,
          amount: 100,
          description: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return filtered transactions', async () => {
      const mockTransactions = [mockTransaction];
      mockPrismaService.transaction.findMany.mockResolvedValue(
        mockTransactions,
      );

      const result = await service.findAll(mockUserId, {
        type: TransactionType.EXPENSE,
      });

      expect(result).toEqual(mockTransactions);
      expect(mockPrismaService.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
            type: TransactionType.EXPENSE,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return transaction if found and belongs to user', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(
        mockTransaction,
      );

      const result = await service.findOne(mockTransaction.id, mockUserId);

      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException if transaction does not exist', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if transaction belongs to different user', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue({
        ...mockTransaction,
        userId: 'different-user',
      });

      await expect(
        service.findOne(mockTransaction.id, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update transaction and adjust account balance', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(
        mockTransaction,
      );
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.transaction.update.mockResolvedValue({
        ...mockTransaction,
        amount: 75,
      });

      const result = await service.update(mockTransaction.id, mockUserId, {
        amount: 75,
      });

      expect(result.amount).toBe(75);
      expect(mockPrismaService.account.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete transaction and revert account balance', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(
        mockTransaction,
      );
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.transaction.delete.mockResolvedValue(mockTransaction);

      const result = await service.remove(mockTransaction.id, mockUserId);

      expect(result.message).toContain('sucesso');
      expect(mockPrismaService.transaction.delete).toHaveBeenCalled();
      expect(mockPrismaService.account.update).toHaveBeenCalled();
    });
  });

  describe('getMonthlyStats', () => {
    it('should calculate monthly statistics correctly', async () => {
      const mockTransactions = [
        { ...mockTransaction, type: TransactionType.INCOME, amount: 3000 },
        { ...mockTransaction, type: TransactionType.EXPENSE, amount: 500 },
        { ...mockTransaction, type: TransactionType.EXPENSE, amount: 300 },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(
        mockTransactions,
      );

      const result = await service.getMonthlyStats(mockUserId, '2025-01');

      expect(result.income).toBe(3000);
      expect(result.expenses).toBe(800);
      expect(result.balance).toBe(2200);
      expect(result.transactionCount).toBe(3);
    });
  });
});
