import { Test, TestingModule } from '@nestjs/testing';
import { PlanningService } from './planning.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnalysisService } from '../analysis/analysis.service';
import { NotFoundException } from '@nestjs/common';

describe('PlanningService', () => {
  let service: PlanningService;

  const mockPrismaService = {
    goal: { findUnique: jest.fn() },
    transaction: { findMany: jest.fn(), groupBy: jest.fn() },
    category: { findMany: jest.fn() },
    goalPlan: { upsert: jest.fn() }
  };

  const mockAnalysisService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanningService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AnalysisService, useValue: mockAnalysisService },
      ],
    }).compile();

    service = module.get<PlanningService>(PlanningService);
  });

  it('should calculate viable plan without cuts', async () => {
      // Goal: 1000 needed in 10 months (100/month)
      // User Surplus: 200/month
      
      mockPrismaService.goal.findUnique.mockResolvedValue({
          id: 'goal1',
          userId: 'user1',
          targetAmount: 1000,
          currentAmount: 0,
          targetDate: new Date(new Date().setMonth(new Date().getMonth() + 10))
      });

      // Mock User Surplus (avg 200)
      mockPrismaService.transaction.findMany.mockResolvedValue([
          { type: 'INCOME', amount: 3000 },
          { type: 'EXPENSE', amount: 2400 } // Surplus 600 total / 3 = 200 avg
      ]);

      const plan = await service.calculateGoalPlan('user1', 'goal1') as any;
      
      expect(plan.isViable).toBe(true);
      expect(plan.actionPlan[0].type).toBe('SAVE');
      expect(plan.recommendations[0]).toContain('margem');
  });

  it('should suggest cuts when unviable', async () => {
      // Goal: 1000 needed in 2 months (500/month)
      // User Surplus: 100/month (Income 1000 - Expense 900)
      // Need 400 more.
      
      mockPrismaService.goal.findUnique.mockResolvedValue({
          id: 'goal2',
          userId: 'user1',
          targetAmount: 1000,
          currentAmount: 0,
          targetDate: new Date(new Date().setMonth(new Date().getMonth() + 2))
      });

      // Surplus 100
      mockPrismaService.transaction.findMany.mockResolvedValue([
          { type: 'INCOME', amount: 3000 }, // 1000 avg
          { type: 'EXPENSE', amount: 2700 } // 900 avg
      ]);

      // Non-Essential Categories
      mockPrismaService.category.findMany.mockResolvedValue([
          { id: 'catLazer', name: 'Lazer', isEssential: false }
      ]);

      // Expense in Lazer: 1500 total / 3 = 500 avg. 
      // Potential cut (50%) = 250.
      mockPrismaService.transaction.groupBy.mockResolvedValue([
          { categoryId: 'catLazer', _sum: { amount: 1500 } } 
      ]);

      const plan = await service.calculateGoalPlan('user1', 'goal2') as any;
      
      expect(plan.isViable).toBe(false);
      // Cuts suggested
      expect(plan.suggestedCuts.length).toBeGreaterThan(0);
      expect(plan.recommendations.some(r => r.includes('Cortes não são suficientes'))).toBe(true); // Need 400, cut 250.
  });
});
