import { Test, TestingModule } from '@nestjs/testing';
import { EmergencyFundService } from './emergency-fund.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException } from '@nestjs/common';

describe('EmergencyFundService', () => {
  let service: EmergencyFundService;

  const mockPrismaService = {
    category: { findMany: jest.fn() },
    transaction: { aggregate: jest.fn() },
    emergencyFund: { 
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn()
    },
    emergencyFundWithdrawal: { create: jest.fn() },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    goal: { update: jest.fn() }
  };

  const mockNotificationsService = {
      create: jest.fn() 
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyFundService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<EmergencyFundService>(EmergencyFundService);
    jest.clearAllMocks();
  });

  describe('setup', () => {
      it('should calculate target based on expenses (3-6 months)', async () => {
          // Mock Essentials
          mockPrismaService.category.findMany.mockResolvedValue([{ id: 'cat1' }]);
          mockPrismaService.transaction.aggregate.mockResolvedValue({ _sum: { amount: 3000 } }); // 1000/month

          mockPrismaService.emergencyFund.create.mockImplementation((args) => args.data);

          const result = await service.setup('user1');

          // 1000 monthly * 6 = 6000 target
          expect(result.targetAmount).toBe(6000);
          expect(mockPrismaService.emergencyFund.create).toHaveBeenCalled();
      });

      it('should fail if already setup', async () => {
          mockPrismaService.emergencyFund.findUnique.mockResolvedValue({ id: '123' });
          await expect(service.setup('user1')).rejects.toThrow(BadRequestException);
      });
  });

  describe('withdraw', () => {
      it('should allow withdrawal if sufficient funds and notify', async () => {
          mockPrismaService.emergencyFund.findUnique.mockResolvedValue({ 
              id: 'fund1', 
              currentAmount: 5000,
              linkedGoalId: null 
          });

          mockPrismaService.emergencyFund.update.mockResolvedValue({ currentAmount: 4000 });

          await service.withdraw('user1', 1000, 'Medical Emergency');

          expect(mockPrismaService.emergencyFundWithdrawal.create).toHaveBeenCalled();
          expect(mockNotificationsService.create).toHaveBeenCalled(); // Verify notification
      });

      it('should block withdrawal if insufficient funds', async () => {
          mockPrismaService.emergencyFund.findUnique.mockResolvedValue({ 
              id: 'fund1', 
              currentAmount: 500 
          });

          await expect(service.withdraw('user1', 1000, 'Test')).rejects.toThrow(BadRequestException);
      });
  });
});
