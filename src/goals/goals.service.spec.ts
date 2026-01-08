import { Test, TestingModule } from '@nestjs/testing';
import { GoalsService } from './goals.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from '../common/services/cache.service';

describe('GoalsService - Hierarchy', () => {
  let service: GoalsService;
  
  const mockPrismaService = {
    goal: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    goalContribution: {
        create: jest.fn()
    }
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: { checkGoalAchieved: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: CacheService, useValue: { logHit: jest.fn(), logMiss: jest.fn() } }
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
  });

  describe('create', () => {
      it('should block creation if depth > 4', async () => {
          // Mock Parent at Level 3 (so Child would be 4, which is max index, 0-3... wait logic says >3 throws)
          // Logic: "if hierarchyLevel > 3 throw"
          // So if Parent is Level 3 (0,1,2,3), Child becomes 4. 4 > 3 is true. Exception.
          mockPrismaService.goal.findUnique.mockResolvedValue({ id: 'parent', userId: 'user1', hierarchyLevel: 3 });
          
          await expect(service.create('user1', { parentId: 'parent', name: 'Deep' } as any))
            .rejects.toThrow(BadRequestException);
      });

      it('should create sub-goal correctly', async () => {
          mockPrismaService.goal.findUnique.mockResolvedValue({ id: 'parent', userId: 'user1', hierarchyLevel: 0 });
          mockPrismaService.goal.create.mockResolvedValue({ id: 'child', hierarchyLevel: 1 });

          const result = await service.create('user1', { parentId: 'parent', name: 'Child' } as any);
          expect(result.hierarchyLevel).toBe(1);
          expect(mockPrismaService.goal.create).toHaveBeenCalledWith(expect.objectContaining({
              data: expect.objectContaining({ hierarchyLevel: 1 })
          }));
      });
  });

  describe('distributeContribution (Proportional)', () => {
      it('should distribute amount proportionally to children', async () => {
          // Parent with 2 children: A (Target 100), B (Target 100). Total 200.
          // Contribution 100 -> 50 each.
          
          const childA = { id: 'childA', targetAmount: 100, currentAmount: 0, status: 'ACTIVE' };
          const childB = { id: 'childB', targetAmount: 100, currentAmount: 0, status: 'ACTIVE' };

          const parent = {
              id: 'parent',
              userId: 'user1',
              status: 'ACTIVE',
              children: [childA, childB],
              distributionStrategy: 'PROPORTIONAL'
          };
          
          mockPrismaService.goal.findUnique
            .mockResolvedValueOnce(parent) // 1. contribute -> findUnique(parent)
            .mockResolvedValueOnce(childA) // 2. addContribution(childA) -> find
            .mockResolvedValueOnce(childB) // 3. addContribution(childB) -> find
            .mockResolvedValueOnce(parent); // 4. updateAggregatedProgress(parent) -> find

          mockPrismaService.goal.update.mockResolvedValue({});
          mockPrismaService.goalContribution.create.mockResolvedValue({});

          await service.contribute('parent', 'user1', { amount: 100 } as any);

          // Expect 2 contributions
          expect(mockPrismaService.goalContribution.create).toHaveBeenCalledTimes(2);
          
          // Verify amounts
          const calls = mockPrismaService.goalContribution.create.mock.calls;
          // Order might vary depending on loop, but both should be 50
          expect(calls[0][0].data.amount).toBe(50);
          expect(calls[1][0].data.amount).toBe(50);
      });
  });
});
