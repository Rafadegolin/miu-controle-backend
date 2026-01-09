import { Test, TestingModule } from '@nestjs/testing';
import { ProactiveAlertsService } from './proactive-alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AlertPriority } from '@prisma/client';

describe('ProactiveAlertsService', () => {
  let service: ProactiveAlertsService;
  let prisma: PrismaService;
  let notificationsService: NotificationsService;

  const mockPrisma = {
    user: {
      findMany: jest.fn(),
    },
    account: {
      findMany: jest.fn(),
    },
    recurringTransaction: {
      findMany: jest.fn(),
    },
    proactiveAlert: {
      findFirst: jest.fn(), // Check duplicate
      create: jest.fn(), // Create alert
    },
  };

  const mockNotificationsService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProactiveAlertsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<ProactiveAlertsService>(ProactiveAlertsService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationsService = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkNegativeBalance', () => {
    it('should create an alert if projected balance is negative', async () => {
      // Setup: Balance 500, Expense 600 -> Result -100
      mockPrisma.account.findMany.mockResolvedValue([
          { isActive: true, currentBalance: 500 }
      ]);
      mockPrisma.recurringTransaction.findMany.mockResolvedValue([
          { amount: 600, type: 'EXPENSE' }
      ]);
      mockPrisma.proactiveAlert.findFirst.mockResolvedValue(null); // No recent alert
      mockPrisma.proactiveAlert.create.mockResolvedValue({ id: 'alert-1' });

      await service.checkNegativeBalance('user-1');

      expect(mockPrisma.proactiveAlert.create).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({
              type: 'NEGATIVE_BALANCE',
              priority: 'CRITICAL'
          })
      }));
      expect(mockNotificationsService.create).toHaveBeenCalled();
    });

    it('should NOT create an alert if balance remains positive', async () => {
        // Setup: Balance 1000, Expense 600 -> Result 400
        mockPrisma.account.findMany.mockResolvedValue([
            { isActive: true, currentBalance: 1000 }
        ]);
        mockPrisma.recurringTransaction.findMany.mockResolvedValue([
            { amount: 600, type: 'EXPENSE' }
        ]);
  
        await service.checkNegativeBalance('user-1');
  
        expect(mockPrisma.proactiveAlert.create).not.toHaveBeenCalled();
    });

    it('should ignore if duplicate alert exists in last 24h', async () => {
        // Setup: Negative balance but recent alert exists
        mockPrisma.account.findMany.mockResolvedValue([{ currentBalance: 0 }]);
        mockPrisma.recurringTransaction.findMany.mockResolvedValue([{ amount: 100 }]);
        mockPrisma.proactiveAlert.findFirst.mockResolvedValue({ id: 'existing' });

        await service.checkNegativeBalance('user-1');

        expect(mockPrisma.proactiveAlert.create).not.toHaveBeenCalled();
    });
  });

  describe('checkUpcomingBills', () => {
      it('should warn about upcoming bills', async () => {
          mockPrisma.recurringTransaction.findMany.mockResolvedValue([
              { id: 'tx-1', amount: 100 }
          ]);
          mockPrisma.proactiveAlert.findFirst.mockResolvedValue(null);
          mockPrisma.proactiveAlert.create.mockResolvedValue({ id: 'alert-2' });

          await service.checkUpcomingBills('user-1');

          expect(mockPrisma.proactiveAlert.create).toHaveBeenCalledWith(expect.objectContaining({
              data: expect.objectContaining({
                  type: 'BILL_DUE',
                  priority: 'WARNING'
              })
          }));
      });
  });
});
