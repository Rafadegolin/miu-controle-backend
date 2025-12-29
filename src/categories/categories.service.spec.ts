import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CategoryType } from '@prisma/client';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: PrismaService;

  const mockUserId = 'user-123';
  const mockCategoryId = 'category-456';

  const mockCategory = {
    id: mockCategoryId,
    userId: mockUserId,
    name: 'Alimentação',
    type: CategoryType.EXPENSE,
    parentId: null,
    color: '#EF4444',
    icon: 'food',
    isSystem: false,
    budgetAllocated: null,
    createdAt: new Date(),
  };

  const mockPrismaService = {
    category: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    transaction: {
      count: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const createDto = {
        name: 'Nova Categoria',
        type: CategoryType.EXPENSE,
        color: '#EF4444',
      };

      mockPrismaService.category.create.mockResolvedValue(mockCategory);

      const result = await service.create(mockUserId, createDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.category.create).toHaveBeenCalled();
    });

    it('should create subcategory with valid parent', async () => {
      const parentCategory = { ...mockCategory, id: 'parent-123' };
      const createDto = {
        name: 'Subcategoria',
        type: CategoryType.EXPENSE,
        parentId: 'parent-123',
      };

      mockPrismaService.category.findUnique.mockResolvedValue(parentCategory);
      mockPrismaService.category.create.mockResolvedValue({
        ...mockCategory,
        parentId: 'parent-123',
      });

      const result = await service.create(mockUserId, createDto);

      expect(result.parentId).toBe('parent-123');
    });

    it('should throw NotFoundException if parent does not exist', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create(mockUserId, {
          name: 'Test',
          type: CategoryType.EXPENSE,
          parentId: 'invalid',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if parent type does not match', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        type: CategoryType.INCOME,
      });

      await expect(
        service.create(mockUserId, {
          name: 'Test',
          type: CategoryType.EXPENSE,
          parentId: mockCategoryId,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return user and system categories', async () => {
      const categories = [
        mockCategory,
        { ...mockCategory, id: 'sys-1', isSystem: true, userId: null },
      ];

      mockPrismaService.category.findMany.mockResolvedValue(categories);

      const result = await service.findAll(mockUserId);

      expect(result).toHaveLength(2);
    });

    it('should filter by type when provided', async () => {
      mockPrismaService.category.findMany.mockResolvedValue([mockCategory]);

      await service.findAll(mockUserId, CategoryType.EXPENSE);

      expect(mockPrismaService.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: CategoryType.EXPENSE }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return category with children and transaction count', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        parent: null,
        children: [],
        _count: { transactions: 5 },
      });

      const result = await service.findOne(mockCategoryId, mockUserId);

      expect(result).toBeDefined();
      expect(result._count.transactions).toBe(5);
    });

    it('should throw NotFoundException if category does not exist', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if category belongs to other user', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        userId: 'different-user',
        parent: null,
        children: [],
        _count: { transactions: 0 },
      });

      await expect(
        service.findOne(mockCategoryId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow access to system categories', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        isSystem: true,
        userId: null,
        parent: null,
        children: [],
        _count: { transactions: 0 },
      });

      const result = await service.findOne(mockCategoryId, mockUserId);

      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update category successfully', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        parent: null,
        children: [],
        _count: { transactions: 0 },
      });
      mockPrismaService.category.update.mockResolvedValue({
        ...mockCategory,
        name: 'Updated',
      });

      const result = await service.update(mockCategoryId, mockUserId, {
        name: 'Updated',
      });

      expect(result.name).toBe('Updated');
    });

    it('should throw ForbiddenException when updating system category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        isSystem: true,
        parent: null,
        children: [],
        _count: { transactions: 0 },
      });

      await expect(
        service.update(mockCategoryId, mockUserId, { name: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if category is parent of itself', async () => {
      mockPrismaService.category.findUnique
        .mockResolvedValueOnce({
          ...mockCategory,
          parent: null,
          children: [],
          _count: { transactions: 0 },
        })
        .mockResolvedValueOnce(mockCategory);

      await expect(
        service.update(mockCategoryId, mockUserId, {
          parentId: mockCategoryId,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete category without dependencies', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        parent: null,
        children: [],
        _count: { transactions: 0 },
      });
      mockPrismaService.transaction.count.mockResolvedValue(0);
      mockPrismaService.category.count.mockResolvedValue(0);
      mockPrismaService.category.delete.mockResolvedValue(mockCategory);

      const result = await service.remove(mockCategoryId, mockUserId);

      expect(result.message).toContain('sucesso');
      expect(mockPrismaService.category.delete).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when deleting system category', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        isSystem: true,
        parent: null,
        children: [],
        _count: { transactions: 0 },
      });

      await expect(
        service.remove(mockCategoryId, mockUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if category has transactions', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        parent: null,
        children: [],
        _count: { transactions: 0 },
      });
      mockPrismaService.transaction.count.mockResolvedValue(10);

      await expect(
        service.remove(mockCategoryId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if category has children', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        parent: null,
        children: [],
        _count: { transactions: 0 },
      });
      mockPrismaService.transaction.count.mockResolvedValue(0);
      mockPrismaService.category.count.mockResolvedValue(3);

      await expect(
        service.remove(mockCategoryId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStats', () => {
    it('should return category statistics', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue({
        ...mockCategory,
        parent: null,
        children: [],
        _count: { transactions: 0 },
      });
      mockPrismaService.transaction.findMany.mockResolvedValue([]);
      mockPrismaService.transaction.aggregate.mockResolvedValue({
        _sum: { amount: 1000 },
      });
      mockPrismaService.transaction.count.mockResolvedValue(10);

      const result = await service.getStats(mockUserId, mockCategoryId);

      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('count');
      expect(result).toHaveProperty('average');
    });
  });
});
