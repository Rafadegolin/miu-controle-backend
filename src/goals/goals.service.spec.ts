import { Test, TestingModule } from '@nestjs/testing';
import { GoalsService } from './goals.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { GoalStatus } from '@prisma/client';

describe('GoalsService', () => {
  let service: GoalsService;
  let prisma: PrismaService;
  let notificationsService: NotificationsService;

  const mockUserId = 'user-123';
  const mockGoalId = 'goal-456';

  const mockGoal = {
    id: mockGoalId,
    userId: mockUserId,
    name: 'Comprar Carro',
    description: 'Economizar para carro novo',
    targetAmount: 50000,
    currentAmount: 10000,
    targetDate: new Date('2026-12-31'),
    color: '#10B981',
    icon: 'car',
    priority: 1,
    status: GoalStatus.ACTIVE,
    imageUrl: null,
    imageKey: null,
    imageMimeType: null,
    imageSize: null,
    purchaseLinks: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  };

  const mockPrismaService = {
    goal: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    goalContribution: {
      count: jest.fn(),
      create: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
    },
  };

  const mockNotificationsService = {
    checkGoalAchieved: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationsService = module.get<NotificationsService>(
      NotificationsService,
    );

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new goal', async () => {
      const createDto = {
        name: 'Nova Meta',
        targetAmount: 1000,
        description: 'Descrição',
        targetDate: '2026-12-31',
      };

      mockPrismaService.goal.create.mockResolvedValue(mockGoal);

      const result = await service.create(mockUserId, createDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.goal.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if target date is in the past', async () => {
      const createDto = {
        name: 'Meta',
        targetAmount: 1000,
        targetDate: '2020-01-01',
      };

      await expect(service.create(mockUserId, createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all goals with calculated fields', async () => {
      mockPrismaService.goal.findMany.mockResolvedValue([mockGoal]);

      const result = await service.findAll(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('percentage');
      expect(result[0]).toHaveProperty('remaining');
      expect(result[0]).toHaveProperty('daysRemaining');
    });

    it('should filter by status when provided', async () => {
      mockPrismaService.goal.findMany.mockResolvedValue([mockGoal]);

      await service.findAll(mockUserId, GoalStatus.ACTIVE);

      expect(mockPrismaService.goal.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return goal with contributions', async () => {
      mockPrismaService.goal.findUnique.mockResolvedValue({
        ...mockGoal,
        contributions: [],
        _count: { contributions: 0 },
      });

      const result = await service.findOne(mockGoalId, mockUserId);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('percentage');
    });

    it('should throw NotFoundException if goal does not exist', async () => {
      mockPrismaService.goal.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if goal belongs to different user', async () => {
      mockPrismaService.goal.findUnique.mockResolvedValue({
        ...mockGoal,
        userId: 'different-user',
        contributions: [],
        _count: { contributions: 0 },
      });

      await expect(service.findOne(mockGoalId, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should update goal successfully', async () => {
      mockPrismaService.goal.findUnique.mockResolvedValue({
        ...mockGoal,
        contributions: [],
        _count: { contributions: 0 },
      });
      mockPrismaService.goal.update.mockResolvedValue({
        ...mockGoal,
        name: 'Updated Name',
      });

      const result = await service.update(mockGoalId, mockUserId, {
        name: 'Updated Name',
      });

      expect(result.name).toBe('Updated Name');
    });

    it('should set completedAt when marking as COMPLETED', async () => {
      mockPrismaService.goal.findUnique.mockResolvedValue({
        ...mockGoal,
        contributions: [],
        _count: { contributions: 0 },
      });
      mockPrismaService.goal.update.mockResolvedValue({
        ...mockGoal,
        status: GoalStatus.COMPLETED,
      });

      await service.update(mockGoalId, mockUserId, {
        status: GoalStatus.COMPLETED,
      });

      expect(mockPrismaService.goal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ completedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete goal without contributions', async () => {
      mockPrismaService.goal.findUnique.mockResolvedValue({
        ...mockGoal,
        contributions: [],
        _count: { contributions: 0 },
      });
      mockPrismaService.goalContribution.count.mockResolvedValue(0);
      mockPrismaService.goal.delete.mockResolvedValue(mockGoal);

      const result = await service.remove(mockGoalId, mockUserId);

      expect(result.message).toContain('sucesso');
      expect(mockPrismaService.goal.delete).toHaveBeenCalled();
    });

    it('should throw BadRequestException if goal has contributions', async () => {
      mockPrismaService.goal.findUnique.mockResolvedValue({
        ...mockGoal,
        contributions: [],
        _count: { contributions: 0 },
      });
      mockPrismaService.goalContribution.count.mockResolvedValue(5);

      await expect(service.remove(mockGoalId, mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('contribute', () => {
    it('should add contribution to goal', async () => {
      mockPrismaService.goal.findUnique.mockResolvedValue({
        ...mockGoal,
        contributions: [],
        _count: { contributions: 0 },
      });
      mockPrismaService.goalContribution.create.mockResolvedValue({
        id: 'contrib-123',
        amount: 1000,
        goalId: mockGoalId,
      });
      mockPrismaService.goal.update.mockResolvedValue({
        ...mockGoal,
        currentAmount: 11000,
      });

      const result = await service.contribute(mockGoalId, mockUserId, {
        amount: 1000,
      });

      expect(result.contribution).toBeDefined();
      expect(result.goal).toBeDefined();
      expect(mockNotificationsService.checkGoalAchieved).toHaveBeenCalled();
    });

    it('should mark goal as COMPLETED when target is reached', async () => {
      mockPrismaService.goal.findUnique.mockResolvedValue({
        ...mockGoal,
        currentAmount: 49000,
        contributions: [],
        _count: { contributions: 0 },
      });
      mockPrismaService.goalContribution.create.mockResolvedValue({
        id: 'contrib-123',
        amount: 1000,
        goalId: mockGoalId,
      });
      mockPrismaService.goal.update.mockResolvedValue({
        ...mockGoal,
        currentAmount: 50000,
        status: GoalStatus.COMPLETED,
      });

      await service.contribute(mockGoalId, mockUserId, { amount: 1000 });

      expect(mockPrismaService.goal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: GoalStatus.COMPLETED,
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw BadRequestException for inactive goals', async () => {
      mockPrismaService.goal.findUnique.mockResolvedValue({
        ...mockGoal,
        status: GoalStatus.CANCELLED,
        contributions: [],
        _count: { contributions: 0 },
      });

      await expect(
        service.contribute(mockGoalId, mockUserId, { amount: 1000 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('withdraw', () => {
    it('should withdraw from goal', async () => {
      mockPrismaService.goal.findUnique.mockResolvedValue({
        ...mockGoal,
        currentAmount: 10000,
        contributions: [],
        _count: { contributions: 0 },
      });
      mockPrismaService.goalContribution.create.mockResolvedValue({
        id: 'contrib-123',
        amount: -1000,
        goalId: mockGoalId,
      });
      mockPrismaService.goal.update.mockResolvedValue({
        ...mockGoal,
        currentAmount: 9000,
      });

      const result = await service.withdraw(mockGoalId, mockUserId, 1000);

      expect(result.contribution.amount).toBe(-1000);
      expect(result.goal).toBeDefined();
    });

    it('should throw BadRequestException if amount exceeds current', async () => {
      mockPrismaService.goal.findUnique.mockResolvedValue({
        ...mockGoal,
        currentAmount: 100,
        contributions: [],
        _count: { contributions: 0 },
      });

      await expect(
        service.withdraw(mockGoalId, mockUserId, 1000),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getSummary', () => {
    it('should calculate goals summary', async () => {
      mockPrismaService.goal.findMany.mockResolvedValue([
        mockGoal,
        { ...mockGoal, id: 'goal-2', status: GoalStatus.COMPLETED },
      ]);

      const result = await service.getSummary(mockUserId);

      expect(result.total).toBe(2);
      expect(result.active).toBeGreaterThan(0);
      expect(result).toHaveProperty('totalTargeted');
      expect(result).toHaveProperty('totalSaved');
      expect(result.goals).toHaveLength(2);
    });
  });
});
