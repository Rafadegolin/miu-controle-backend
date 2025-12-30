import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditEntity } from '../common/enums/audit-entity.enum';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('deve criar um registro de auditoria', async () => {
      const logParams = {
        userId: 'user-123',
        action: AuditAction.CREATE,
        entity: AuditEntity.TRANSACTION,
        entityId: 'transaction-123',
        before: null,
        after: { amount: 100, description: 'Test' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      mockPrismaService.auditLog.create.mockResolvedValue({
        id: 'audit-123',
        ...logParams,
        createdAt: new Date(),
      });

      await service.log(logParams);

      // Aguardar a promise assíncrona
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: logParams.userId,
          action: logParams.action,
          entity: logParams.entity,
          entityId: logParams.entityId,
          before: logParams.before,
          after: logParams.after,
          ipAddress: logParams.ipAddress,
          userAgent: logParams.userAgent,
        },
      });
    });

    it('não deve lançar erro se a criação do log falhar', async () => {
      const logParams = {
        userId: 'user-123',
        action: AuditAction.CREATE,
        entity: AuditEntity.TRANSACTION,
        entityId: 'transaction-123',
      };

      mockPrismaService.auditLog.create.mockRejectedValue(
        new Error('Database error'),
      );

      // Não deve lançar erro
      await expect(service.log(logParams)).resolves.not.toThrow();
    });
  });

  describe('getUserAuditLogs', () => {
    it('deve retornar logs do usuário com paginação', async () => {
      const userId = 'user-123';
      const mockLogs = [
        {
          id: 'audit-1',
          userId,
          action: AuditAction.CREATE,
          entity: AuditEntity.TRANSACTION,
          createdAt: new Date(),
        },
        {
          id: 'audit-2',
          userId,
          action: AuditAction.UPDATE,
          entity: AuditEntity.ACCOUNT,
          createdAt: new Date(),
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getUserAuditLogs(userId, { take: 50 });

      expect(result.items).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBe(null);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId },
        take: 51,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('deve filtrar por ação', async () => {
      const userId = 'user-123';
      mockPrismaService.auditLog.findMany.mockResolvedValue([]);

      await service.getUserAuditLogs(userId, {
        take: 50,
        action: AuditAction.DELETE,
      });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId, action: AuditAction.DELETE },
        take: 51,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('deve filtrar por data', async () => {
      const userId = 'user-123';
      const startDate = '2025-01-01T00:00:00.000Z';
      const endDate = '2025-12-31T23:59:59.999Z';

      mockPrismaService.auditLog.findMany.mockResolvedValue([]);

      await service.getUserAuditLogs(userId, {
        take: 50,
        startDate,
        endDate,
      });

      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
        take: 51,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getEntityAuditLogs', () => {
    it('deve retornar logs de uma entidade específica', async () => {
      const entity = AuditEntity.TRANSACTION;
      const entityId = 'transaction-123';
      const mockLogs = [
        {
          id: 'audit-1',
          entity,
          entityId,
          action: AuditAction.CREATE,
          user: { id: 'user-1', email: 'test@example.com', fullName: 'Test User' },
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getEntityAuditLogs(entity, entityId, {
        take: 50,
      });

      expect(result.items).toHaveLength(1);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: { entity, entityId },
        take: 51,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getAdminAuditLogs', () => {
    it('deve retornar todos os logs do sistema', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          action: AuditAction.CREATE,
          user: { id: 'user-1', email: 'user1@example.com' },
        },
        {
          id: 'audit-2',
          action: AuditAction.DELETE,
          user: { id: 'user-2', email: 'user2@example.com' },
        },
      ];

      mockPrismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getAdminAuditLogs({ take: 50 });

      expect(result.items).toHaveLength(2);
      expect(mockPrismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        take: 51,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
