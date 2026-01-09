import { Test, TestingModule } from '@nestjs/testing';
import { InflationSimulatorService } from './inflation-simulator.service';
import { GoalsService } from '../goals/goals.service';
import { BudgetsService } from '../budgets/budgets.service';

describe('InflationSimulatorService', () => {
  let service: InflationSimulatorService;

  const mockGoalsService = {
      findAll: jest.fn().mockResolvedValue([
          { 
              id: 'g1', 
              name: 'Carro Novo', 
              targetAmount: 50000, 
              targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) // 1 year from now
          }
      ])
  };

  const mockBudgetsService = {
      findAll: jest.fn().mockResolvedValue([
          {
              id: 'b1',
              amount: 1000,
              category: { name: 'Mercado' }
          }
      ])
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InflationSimulatorService,
        { provide: GoalsService, useValue: mockGoalsService },
        { provide: BudgetsService, useValue: mockBudgetsService },
      ],
    }).compile();

    service = module.get<InflationSimulatorService>(InflationSimulatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('simulate', () => {
      it('should calculate negative real gain correctly', async () => {
          // Inflation 5%, Salary 0% -> Real Gain should be approx -4.76%
          const result = await service.simulate('user1', {
              inflationRate: 5.0,
              salaryAdjustment: 0,
              periodMonths: 12
          });

          expect(result.realGainRate).toBeLessThan(0);
          expect(result.purchasingPowerLost).toBeGreaterThan(0);
          expect(result.affectedGoals.length).toBe(1);
          expect(result.affectedGoals[0].adjustedTarget).toBeGreaterThan(50000); // 50000 * 1.05 = 52500
      });

      it('should calculate positive real gain correctly', async () => {
          // Inflation 3%, Salary 5% -> Real Gain positive
          const result = await service.simulate('user1', {
              inflationRate: 3.0,
              salaryAdjustment: 5.0,
              periodMonths: 12
          });

          expect(result.realGainRate).toBeGreaterThan(0);
          expect(result.recommendations[0]).toContain('ganhando da inflação');
      });
      
      it('should return scenarios', () => {
          const scenarios = service.getScenarios();
          expect(scenarios.length).toBeGreaterThan(0);
          expect(scenarios[0].inflationRate).toBeDefined();
      });
  });
});
