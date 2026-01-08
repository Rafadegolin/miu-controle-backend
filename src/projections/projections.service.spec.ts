import { Test, TestingModule } from '@nestjs/testing';
import { ProjectionsService } from './projections.service';
import { PrismaService } from '../prisma/prisma.service';
import { PredictionEngineService } from '../predictions/services/prediction-engine.service';
import { RecurringTransactionsService } from '../recurring-transactions/recurring-transactions.service';
import { ProjectionScenario } from './dto/cash-flow-projection-query.dto';

describe('ProjectionsService', () => {
  let service: ProjectionsService;
  
  const mockPrismaService = {
    account: {
      findMany: jest.fn().mockResolvedValue([{ currentBalance: 1000 }]),
    },
  };

  const mockPredictionService = {
    detectVariableCategories: jest.fn().mockResolvedValue(['cat1']),
    predictCategoryExpense: jest.fn().mockImplementation((userId, catId, date) => {
        return {
            predictedAmount: 500,
            upperBound: 600, // stdDev = 100
            lowerBound: 400
        };
    }),
  };

  const mockRecurringService = {
    findAll: jest.fn().mockResolvedValue([
        {
            amount: 2000,
            type: 'INCOME',
            frequency: 'MONTHLY',
            isActive: true,
            startDate: new Date('2024-01-01')
        },
        {
            amount: 1000,
            type: 'EXPENSE',
            frequency: 'MONTHLY',
            isActive: true,
            startDate: new Date('2024-01-01')
        }
    ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PredictionEngineService, useValue: mockPredictionService },
        { provide: RecurringTransactionsService, useValue: mockRecurringService },
      ],
    }).compile();

    service = module.get<ProjectionsService>(ProjectionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate realistic scenario correctly', async () => {
     // Initial: 1000
     // Monthly Fixed Income: 2000
     // Monthly Fixed Expense: 1000
     // Predicted Variable: 500
     // Net Change: +500
     
     const result = await service.calculateCashFlow('user1', { months: 3, scenario: ProjectionScenario.REALISTIC });
     
     expect(result.initialBalance).toBe(1000);
     expect(result.months).toBe(3);
     expect(result.data.length).toBe(3);
     
     // Month 1
     // Balance Period: 2000 - (1000 + 500) = 500
     // Accumulated: 1000 + 500 = 1500
     expect(result.data[0].balance.period).toBe(500);
     expect(result.data[0].balance.accumulated).toBe(1500);
     
     // Month 2
     expect(result.data[1].balance.accumulated).toBe(2000);
  });

  it('should calculate optimistic scenario correctly', async () => {
      // Optimistic: Variable Expense reduced by StdDev
      // Pred: 500, Upper: 600 -> StdDev = 100
      // Opt Variable: 500 - 100 = 400
      // Net Change: 2000 - (1000 + 400) = +600
      
      const result = await service.calculateCashFlow('user1', { months: 1, scenario: ProjectionScenario.OPTIMISTIC });
      
      expect(result.data[0].expenses.variable).toBe(400); 
      expect(result.data[0].balance.accumulated).toBe(1600); // 1000 + 600
  });

  it('should calculate pessimistic scenario correctly', async () => {
      // Pessimistic: Variable Expense increased by StdDev
      // Pess Variable: 500 + 100 = 600
      // Net Change: 2000 - (1000 + 600) = +400
      
      const result = await service.calculateCashFlow('user1', { months: 1, scenario: ProjectionScenario.PESSIMISTIC });
      
      expect(result.data[0].expenses.variable).toBe(600); 
      expect(result.data[0].balance.accumulated).toBe(1400); // 1000 + 400
  });
});
