import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AccountType } from '@prisma/client';

describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: PrismaService;

  const mockUserId = 'user-123';
  const mockAccountId = 'account-456';

  const mockAccount = {
    id: mockAccountId,
    userId: mockUserId,
    name: 'Conta Corrente',
    type: AccountType.CHECKING,
    bankCode: '001',
    initialBalance: 1000,
    currentBalance: 1500,
    currency: 'BRL',
    color: '#6366F1',
    icon: 'bank',
    isActive: true,
    openBankingConnected: false,
    openBankingConsentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    account: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create a new account', async () => {
      const createDto = {
        name: 'Nova Conta',
        type: AccountType.SAVINGS,
        initialBalance: 2000,
        color: '#10B981',
      };

      mockPrismaService.account.create.mockResolvedValue({
        ...mockAccount,
        ...createDto,
        currentBalance: createDto.initialBalance,
      });

      const result = await service.create(mockUserId, createDto);

      expect(result.name).toBe(createDto.name);
      expect(result.type).toBe(createDto.type);
      expect(mockPrismaService.account.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          name: createDto.name,
          type: createDto.type,
          bankCode: undefined,
          initialBalance: createDto.initialBalance,
          currentBalance: createDto.initialBalance,
          color: createDto.color,
          icon: undefined,
        },
      });
    });

    it('should use default values when not provided', async () => {
      const createDto = {
        name: 'Carteira',
        type: AccountType.CHECKING,
      };

      mockPrismaService.account.create.mockResolvedValue(mockAccount);

      await service.create(mockUserId, createDto);

      expect(mockPrismaService.account.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          initialBalance: 0,
          currentBalance: 0,
          color: '#6366F1',
        }),
      });
    });
  });

  describe('findAll', () => {
    it('should return all active accounts by default', async () => {
      const mockAccounts = [mockAccount, { ...mockAccount, id: 'account-789' }];
      mockPrismaService.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.findAll(mockUserId);

      expect(result).toEqual(mockAccounts);
      expect(mockPrismaService.account.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isActive: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should return all accounts including inactive when activeOnly=false', async () => {
      const mockAccounts = [
        mockAccount,
        { ...mockAccount, id: 'account-789', isActive: false },
      ];
      mockPrismaService.account.findMany.mockResolvedValue(mockAccounts);

      const result = await service.findAll(mockUserId, false);

      expect(result).toEqual(mockAccounts);
      expect(mockPrismaService.account.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return account if found and belongs to user', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);

      const result = await service.findOne(mockAccountId, mockUserId);

      expect(result).toEqual(mockAccount);
      expect(mockPrismaService.account.findUnique).toHaveBeenCalledWith({
        where: { id: mockAccountId },
      });
    });

    it('should throw NotFoundException if account does not exist', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.findOne(mockAccountId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if account belongs to different user', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        ...mockAccount,
        userId: 'different-user',
      });

      await expect(service.findOne(mockAccountId, mockUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should successfully update an account', async () => {
      const updateDto = {
        name: 'Conta Atualizada',
        color: '#EF4444',
      };

      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.account.update.mockResolvedValue({
        ...mockAccount,
        ...updateDto,
      });

      const result = await service.update(mockAccountId, mockUserId, updateDto);

      expect(result.name).toBe(updateDto.name);
      expect(result.color).toBe(updateDto.color);
      expect(mockPrismaService.account.update).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        data: updateDto,
      });
    });

    it('should throw error if account not found', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(
        service.update(mockAccountId, mockUserId, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if account belongs to different user', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue({
        ...mockAccount,
        userId: 'different-user',
      });

      await expect(
        service.update(mockAccountId, mockUserId, { name: 'New Name' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should soft delete account (set isActive to false)', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(mockAccount);
      mockPrismaService.account.update.mockResolvedValue({
        ...mockAccount,
        isActive: false,
      });

      const result = await service.remove(mockAccountId, mockUserId);

      expect(result.isActive).toBe(false);
      expect(mockPrismaService.account.update).toHaveBeenCalledWith({
        where: { id: mockAccountId },
        data: { isActive: false },
      });
    });

    it('should throw error if account not found', async () => {
      mockPrismaService.account.findUnique.mockResolvedValue(null);

      await expect(service.remove(mockAccountId, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getBalance', () => {
    it('should calculate total balance from active accounts', async () => {
      const accounts = [
        { ...mockAccount, currentBalance: 1000 },
        { ...mockAccount, id: 'acc-2', currentBalance: 2500 },
        { ...mockAccount, id: 'acc-3', currentBalance: 500 },
      ];

      mockPrismaService.account.findMany.mockResolvedValue(accounts);

      const result = await service.getBalance(mockUserId);

      expect(result.totalBalance).toBe(4000);
      expect(result.accounts).toHaveLength(3);
      expect(result.accounts[0]).toHaveProperty('id');
      expect(result.accounts[0]).toHaveProperty('balance');
    });

    it('should return zero balance if no accounts', async () => {
      mockPrismaService.account.findMany.mockResolvedValue([]);

      const result = await service.getBalance(mockUserId);

      expect(result.totalBalance).toBe(0);
      expect(result.accounts).toHaveLength(0);
    });

    it('should format account data correctly', async () => {
      mockPrismaService.account.findMany.mockResolvedValue([mockAccount]);

      const result = await service.getBalance(mockUserId);

      expect(result.accounts[0]).toEqual({
        id: mockAccount.id,
        name: mockAccount.name,
        type: mockAccount.type,
        balance: Number(mockAccount.currentBalance),
        color: mockAccount.color,
        icon: mockAccount.icon,
      });
    });
  });
});
