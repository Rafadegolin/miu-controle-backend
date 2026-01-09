import { Test, TestingModule } from '@nestjs/testing';
import { ScenariosService } from './scenarios.service';
import { AnalysisService } from '../analysis/analysis.service';
import { GoalsService } from '../goals/goals.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScenarioType } from './dto/simulate-scenario.dto';

describe('ScenariosService', () => {
  let service: ScenariosService;
  let prisma: PrismaService;

  const mockPrisma = {
    transaction: {
      findMany: jest.fn(),
    },
    account: {
        findMany: jest.fn().mockResolvedValue([{ currentBalance: 1000 }])
    }
  };

  const mockGoalsService = {
    findAll: jest.fn().mockResolvedValue([]),
  };

  const mockAnalysisService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenariosService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GoalsService, useValue: mockGoalsService },
        { provide: AnalysisService, useValue: mockAnalysisService },
      ],
    }).compile();

    service = module.get<ScenariosService>(ScenariosService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('simulate', () => {
      it('should return viable result for small purchase', async () => {
          // Mock baseline data (3000 income, 1000 expense => 2000 surplus)
          mockPrisma.transaction.findMany.mockResolvedValue([
              { amount: 3000, type: 'INCOME' },
              { amount: 1000, type: 'EXPENSE' },
              { amount: 3000, type: 'INCOME' },
              { amount: 1000, type: 'EXPENSE' },
              { amount: 3000, type: 'INCOME' },
              { amount: 1000, type: 'EXPENSE' },
          ]);

          const result = await service.simulate('user1', {
              type: ScenarioType.BIG_PURCHASE,
              amount: 500,
              startDate: '2024-01-01'
          });

          expect(result.isViable).toBe(true);
          expect(result.lowestBalance).toBeGreaterThan(0);
          expect(result.recommendations.length).toBe(0);
      });

      it('should return non-viable result for huge purchase', async () => {
          // 2000 surplus/mo, starting 1000. 12 months = 24000 + 1000 = 25000 approx.
          // Purchase 50000
          
          mockPrisma.transaction.findMany.mockResolvedValue([
              { amount: 3000, type: 'INCOME' },
              { amount: 1000, type: 'EXPENSE' }, 
              // Need 3 entries for average
               { amount: 3000, type: 'INCOME' },
              { amount: 1000, type: 'EXPENSE' }, 
               { amount: 3000, type: 'INCOME' },
              { amount: 1000, type: 'EXPENSE' }, 
          ]);

          const result = await service.simulate('user1', {
              type: ScenarioType.BIG_PURCHASE,
              amount: 50000,
              startDate: '2024-01-01'
          });

          expect(result.isViable).toBe(false);
          expect(result.recommendations.some(r => r.type === 'DELAY')).toBe(true);
      });

      it('should suggest installments', async () => {
           mockPrisma.transaction.findMany.mockResolvedValue([
              { amount: 3000, type: 'INCOME' },
              { amount: 1000, type: 'EXPENSE' }, 
               { amount: 3000, type: 'INCOME' },
              { amount: 1000, type: 'EXPENSE' }, 
               { amount: 3000, type: 'INCOME' },
              { amount: 1000, type: 'EXPENSE' }, 
          ]);

          const result = await service.simulate('user1', {
              type: ScenarioType.BIG_PURCHASE,
              amount: 50000,
              startDate: '2024-01-01'
          });
          
          expect(result.recommendations.some(r => r.type === 'INSTALLMENT')).toBe(true);
      });
  });
});
