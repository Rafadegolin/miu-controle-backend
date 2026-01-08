import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisService } from './analysis.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AnalysisService', () => {
  let service: AnalysisService;
  
  const mockPrismaService = {
    transaction: {
      findMany: jest.fn(),
    },
    monthlyReport: {
        upsert: jest.fn().mockImplementation((args) => args.create),
    }
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AnalysisService>(AnalysisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateMonthlyReport', () => {
      it('should generate a correct report with realistic scenarios', async () => {
          // 1. Mock Current Month (Income 5000, Exp 2000)
          mockPrismaService.transaction.findMany.mockResolvedValueOnce([
              { amount: 5000, type: 'INCOME', date: new Date('2024-02-10') },
              { amount: 2000, type: 'EXPENSE', categoryId: 'cat1', category: { name: 'Food', color: '#000' }, date: new Date('2024-02-15') },
          ]);

          // 2. Mock Prev Month (Income 4800, Exp 2200)
          mockPrismaService.transaction.findMany.mockResolvedValueOnce([
              { amount: 4800, type: 'INCOME', date: new Date('2024-01-10') },
              { amount: 2200, type: 'EXPENSE', categoryId: 'cat1', category: { name: 'Food', color: '#000' }, date: new Date('2024-01-15') },
          ]);

          // 3. Mock Average (Using empty for now to avoid complexity in test)
          // The service might call findMany logic here depending on implementation.
          // If the implementation changes to use GroupBy this test will break, but for now we mocked findMany.
          // Let's assume average returns 0 if no transactions found.
          mockPrismaService.transaction.findMany.mockResolvedValue([]); 

          const report: any = await service.generateMonthlyReport('user1', new Date('2024-02-01'));

          expect(report.userId).toBe('user1');
          expect(report.totalIncome).toBe(5000);
          expect(report.totalExpense).toBe(2000); 
          expect(report.balance).toBe(3000);
          
          // Verify Upsert was called
          expect(mockPrismaService.monthlyReport.upsert).toHaveBeenCalled();
          const createArgs = mockPrismaService.monthlyReport.upsert.mock.calls[0][0].create;
          
          // Verify Comparison Delta Logic
          // Income: 4800 -> 5000 (+4.1666%)
          expect(createArgs.comparisonPrev.incomeDiff).toBeCloseTo(4.17, 1);
          
          // Expense: 2200 -> 2000 (-9.09%)
          expect(createArgs.comparisonPrev.expenseDiff).toBeCloseTo(-9.09, 1);
      });
  });
});
