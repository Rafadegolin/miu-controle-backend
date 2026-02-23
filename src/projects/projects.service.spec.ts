/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebsocketService } from '../websocket/websocket.service';
import { CacheService } from '../common/services/cache.service';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProjectStatus, ProjectItemStatus, QuoteStatus } from '@prisma/client';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const USER_ID = 'user-001';
const OTHER_USER = 'user-999';
const PROJECT_ID = 'proj-001';
const ITEM_ID = 'item-001';
const QUOTE_ID = 'quote-001';
const ACCOUNT_ID = 'acc-001';

const makeProject = (overrides = {}) => ({
  id: PROJECT_ID,
  userId: USER_ID,
  name: 'Arrumar Carro',
  description: null,
  status: ProjectStatus.PLANNING,
  totalBudget: null,
  deadline: null,
  color: '#6366F1',
  icon: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { items: 0 },
  ...overrides,
});

const makeItem = (overrides = {}) => ({
  id: ITEM_ID,
  projectId: PROJECT_ID,
  name: 'Bateria nova',
  description: null,
  quantity: 1,
  status: ProjectItemStatus.PENDING,
  priority: 3,
  transactionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  project: { id: PROJECT_ID, userId: USER_ID, name: 'Arrumar Carro' },
  quotes: [],
  ...overrides,
});

const makeQuote = (overrides = {}) => ({
  id: QUOTE_ID,
  itemId: ITEM_ID,
  supplierName: 'AutoPeças',
  price: 450,
  additionalCosts: 0,
  notes: null,
  status: QuoteStatus.PENDING,
  createdAt: new Date(),
  updatedAt: new Date(),
  item: {
    projectId: PROJECT_ID,
    project: { id: PROJECT_ID, userId: USER_ID },
  },
  ...overrides,
});

const mockPrisma = {
  project: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  projectItem: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  quote: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  account: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  category: {
    findUnique: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockWebsocket = {
  emitToUser: jest.fn(),
};

const mockCache = {
  invalidateUserCache: jest.fn(),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WebsocketService, useValue: mockWebsocket },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);

    // Reset todos os mocks antes de cada teste
    jest.clearAllMocks();
  });

  // ═══ createProject ═══════════════════════════════════════════════════════════

  describe('createProject', () => {
    it('deve criar projeto com os dados corretos', async () => {
      const created = makeProject({ name: 'Reforma' });
      mockPrisma.project.create.mockResolvedValue(created);

      const result = await service.createProject(USER_ID, {
        name: 'Reforma',
        color: '#FF0000',
      });

      expect(mockPrisma.project.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            name: 'Reforma',
            status: ProjectStatus.PLANNING,
          }),
        }),
      );
      expect(result).toEqual(created);
    });

    it('deve invalidar o cache após criar projeto', async () => {
      mockPrisma.project.create.mockResolvedValue(makeProject());
      await service.createProject(USER_ID, { name: 'Proj' });
      expect(mockCache.invalidateUserCache).toHaveBeenCalledWith(USER_ID);
    });
  });

  // ═══ findOneProject ═══════════════════════════════════════════════════════════

  describe('findOneProject', () => {
    it('deve retornar projeto do usuário', async () => {
      const proj = makeProject();
      mockPrisma.project.findUnique.mockResolvedValue(proj);
      const result = await service.findOneProject(USER_ID, PROJECT_ID);
      expect(result).toEqual(proj);
    });

    it('deve lançar NotFoundException se projeto não existe', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      await expect(
        service.findOneProject(USER_ID, 'inexistente'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar NotFoundException se projeto pertence a outro usuário', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(
        makeProject({ userId: OTHER_USER }),
      );
      await expect(service.findOneProject(USER_ID, PROJECT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ═══ addItem ═════════════════════════════════════════════════════════════════

  describe('addItem', () => {
    it('deve adicionar item ao projeto com status PENDING', async () => {
      const proj = {
        id: PROJECT_ID,
        userId: USER_ID,
        name: 'P',
        status: ProjectStatus.PLANNING,
      };
      const item = makeItem();
      mockPrisma.project.findUnique.mockResolvedValue(proj);
      mockPrisma.projectItem.create.mockResolvedValue(item);

      const result = await service.addItem(USER_ID, PROJECT_ID, {
        name: 'Bateria nova',
      });

      expect(mockPrisma.projectItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: PROJECT_ID,
            name: 'Bateria nova',
            status: ProjectItemStatus.PENDING,
          }),
        }),
      );
      expect(result).toEqual(item);
    });

    it('deve lançar NotFoundException ao adicionar item em projeto de outro usuário', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(
        makeProject({ userId: OTHER_USER }),
      );
      await expect(
        service.addItem(USER_ID, PROJECT_ID, { name: 'Bateria' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ═══ addQuote ════════════════════════════════════════════════════════════════

  describe('addQuote', () => {
    it('deve adicionar cotação e atualizar status do item para QUOTED', async () => {
      const item = makeItem({ status: ProjectItemStatus.PENDING, quotes: [] });
      const quote = makeQuote();
      mockPrisma.projectItem.findUnique.mockResolvedValue(item);
      mockPrisma.quote.create.mockResolvedValue(quote);
      mockPrisma.projectItem.update.mockResolvedValue({});

      await service.addQuote(USER_ID, PROJECT_ID, ITEM_ID, {
        supplierName: 'AutoPeças',
        price: 450,
      });

      expect(mockPrisma.projectItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ProjectItemStatus.QUOTED },
        }),
      );
    });

    it('não deve atualizar status se item já está em QUOTED', async () => {
      const item = makeItem({
        status: ProjectItemStatus.QUOTED,
        quotes: [makeQuote()],
      });
      mockPrisma.projectItem.findUnique.mockResolvedValue(item);
      mockPrisma.quote.create.mockResolvedValue(makeQuote({ id: 'quote-002' }));

      await service.addQuote(USER_ID, PROJECT_ID, ITEM_ID, {
        supplierName: 'MercadoLivre',
        price: 420,
        additionalCosts: 30,
      });

      // update NÃO deve ser chamado pois item já está QUOTED
      expect(mockPrisma.projectItem.update).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException ao adicionar cotação em item PURCHASED', async () => {
      const item = makeItem({ status: ProjectItemStatus.PURCHASED });
      mockPrisma.projectItem.findUnique.mockResolvedValue(item);

      await expect(
        service.addQuote(USER_ID, PROJECT_ID, ITEM_ID, {
          supplierName: 'X',
          price: 100,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ═══ selectQuote ═════════════════════════════════════════════════════════════

  describe('selectQuote', () => {
    it('deve selecionar cotação e desmarcar as demais do item', async () => {
      const quote = makeQuote({ status: QuoteStatus.PENDING });
      mockPrisma.quote.findUnique.mockResolvedValue(quote);
      mockPrisma.$transaction.mockImplementation(async (ops) => {
        return Promise.all(ops);
      });
      mockPrisma.quote.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.quote.update.mockResolvedValue({
        ...quote,
        status: QuoteStatus.SELECTED,
      });

      await service.selectQuote(USER_ID, PROJECT_ID, ITEM_ID, QUOTE_ID);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('deve lançar ConflictException ao selecionar cotação já CONVERTED', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(
        makeQuote({ status: QuoteStatus.CONVERTED }),
      );
      await expect(
        service.selectQuote(USER_ID, PROJECT_ID, ITEM_ID, QUOTE_ID),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ═══ convertQuote ════════════════════════════════════════════════════════════

  describe('convertQuote', () => {
    const mockItemWithProject = makeItem({
      status: ProjectItemStatus.QUOTED,
    });
    const mockSelectedQuote = {
      id: QUOTE_ID,
      itemId: ITEM_ID,
      price: 450,
      additionalCosts: 30,
      supplierName: 'AutoPeças',
      status: QuoteStatus.SELECTED,
    };
    const mockAccount = {
      id: ACCOUNT_ID,
      userId: USER_ID,
      currentBalance: 1000,
    };
    const mockTransaction = {
      id: 'tx-001',
      amount: 480,
      description: '[Projeto] Bateria nova',
      type: 'EXPENSE',
      category: null,
      account: mockAccount,
    };

    it('deve criar transação e marcar item como PURCHASED', async () => {
      mockPrisma.projectItem.findUnique.mockResolvedValue(mockItemWithProject);
      mockPrisma.quote.findFirst.mockResolvedValue(mockSelectedQuote);
      mockPrisma.account.findUnique.mockResolvedValue(mockAccount);
      mockPrisma.$transaction.mockImplementation(async (fn) =>
        fn({
          transaction: { create: jest.fn().mockResolvedValue(mockTransaction) },
          account: { update: jest.fn().mockResolvedValue({}) },
          quote: { update: jest.fn().mockResolvedValue({}) },
          projectItem: {
            update: jest.fn().mockResolvedValue({
              ...mockItemWithProject,
              status: ProjectItemStatus.PURCHASED,
              transactionId: 'tx-001',
            }),
          },
        }),
      );
      mockPrisma.projectItem.findMany.mockResolvedValue([
        { status: ProjectItemStatus.PURCHASED },
      ]);
      mockPrisma.project.update.mockResolvedValue({});

      const result = await service.convertQuote(USER_ID, PROJECT_ID, ITEM_ID, {
        accountId: ACCOUNT_ID,
      });

      expect(result).toHaveProperty('transaction');
      expect(result).toHaveProperty('projectStatus');
      expect(mockWebsocket.emitToUser).toHaveBeenCalledWith(
        USER_ID,
        expect.any(String),
        expect.any(Object),
      );
    });

    it('deve lançar ConflictException se item já foi comprado', async () => {
      mockPrisma.projectItem.findUnique.mockResolvedValue(
        makeItem({ status: ProjectItemStatus.PURCHASED }),
      );
      await expect(
        service.convertQuote(USER_ID, PROJECT_ID, ITEM_ID, {
          accountId: ACCOUNT_ID,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('deve lançar UnprocessableEntityException se não há cotação SELECTED', async () => {
      mockPrisma.projectItem.findUnique.mockResolvedValue(mockItemWithProject);
      mockPrisma.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.convertQuote(USER_ID, PROJECT_ID, ITEM_ID, {
          accountId: ACCOUNT_ID,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('deve lançar NotFoundException se conta não existe', async () => {
      mockPrisma.projectItem.findUnique.mockResolvedValue(mockItemWithProject);
      mockPrisma.quote.findFirst.mockResolvedValue(mockSelectedQuote);
      mockPrisma.account.findUnique.mockResolvedValue(null);

      await expect(
        service.convertQuote(USER_ID, PROJECT_ID, ITEM_ID, {
          accountId: 'acc-inexistente',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve lançar ForbiddenException se conta pertence a outro usuário', async () => {
      mockPrisma.projectItem.findUnique.mockResolvedValue(mockItemWithProject);
      mockPrisma.quote.findFirst.mockResolvedValue(mockSelectedQuote);
      mockPrisma.account.findUnique.mockResolvedValue({
        ...mockAccount,
        userId: OTHER_USER,
      });

      await expect(
        service.convertQuote(USER_ID, PROJECT_ID, ITEM_ID, {
          accountId: ACCOUNT_ID,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ═══ syncProjectStatus (via removeItem) ══════════════════════════════════════

  describe('syncProjectStatus', () => {
    it('deve marcar projeto como COMPLETED quando todos os itens estão PURCHASED', async () => {
      const proj = {
        id: PROJECT_ID,
        userId: USER_ID,
        name: 'P',
        status: ProjectStatus.IN_PROGRESS,
      };
      const item = makeItem();
      mockPrisma.project.findUnique.mockResolvedValue(proj);
      mockPrisma.projectItem.findUnique.mockResolvedValue(item);
      mockPrisma.projectItem.delete.mockResolvedValue({});
      // Após remoção, apenas itens PURCHASED restam
      mockPrisma.projectItem.findMany.mockResolvedValue([
        { status: ProjectItemStatus.PURCHASED },
      ]);
      mockPrisma.project.update.mockResolvedValue({});

      await service.removeItem(USER_ID, PROJECT_ID, ITEM_ID);

      expect(mockPrisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ProjectStatus.COMPLETED },
        }),
      );
    });

    it('deve manter status PLANNING quando não há itens', async () => {
      const proj = {
        id: PROJECT_ID,
        userId: USER_ID,
        name: 'P',
        status: ProjectStatus.PLANNING,
      };
      const item = makeItem();
      mockPrisma.project.findUnique.mockResolvedValue(proj);
      mockPrisma.projectItem.findUnique.mockResolvedValue(item);
      mockPrisma.projectItem.delete.mockResolvedValue({});
      mockPrisma.projectItem.findMany.mockResolvedValue([]);
      mockPrisma.project.update.mockResolvedValue({});

      await service.removeItem(USER_ID, PROJECT_ID, ITEM_ID);

      expect(mockPrisma.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: ProjectStatus.PLANNING },
        }),
      );
    });
  });

  // ═══ getProjectSummary ════════════════════════════════════════════════════════

  describe('getProjectSummary', () => {
    it('deve calcular corretamente totalBudgeted, totalSpent e savingsVsRejected', async () => {
      const project = {
        ...makeProject({ totalBudget: 1000 }),
        items: [
          {
            id: ITEM_ID,
            name: 'Bateria',
            status: ProjectItemStatus.PURCHASED,
            quotes: [
              {
                id: 'q1',
                status: QuoteStatus.CONVERTED,
                price: 450,
                additionalCosts: 0,
              },
              {
                id: 'q2',
                status: QuoteStatus.REJECTED,
                price: 480,
                additionalCosts: 30,
              },
            ],
          },
        ],
      };
      mockPrisma.project.findUnique.mockResolvedValue(project);

      const summary = await service.getProjectSummary(USER_ID, PROJECT_ID);

      expect(summary.stats.totalBudgeted).toBe(450);
      expect(summary.stats.totalSpent).toBe(450);
      // REJECTED era 510 (480+30), SELECTED era 450 → economia: 510 - 450 = 60
      expect(summary.stats.savingsVsRejected).toBe(60);
      expect(summary.stats.progressPercent).toBe(100);
    });

    it('deve retornar 0% de progresso quando não há itens comprados', async () => {
      const project = {
        ...makeProject(),
        items: [
          {
            id: ITEM_ID,
            name: 'Óleo',
            status: ProjectItemStatus.QUOTED,
            quotes: [
              {
                id: 'q1',
                status: QuoteStatus.SELECTED,
                price: 120,
                additionalCosts: 0,
              },
            ],
          },
        ],
      };
      mockPrisma.project.findUnique.mockResolvedValue(project);

      const summary = await service.getProjectSummary(USER_ID, PROJECT_ID);

      expect(summary.stats.progressPercent).toBe(0);
      expect(summary.stats.totalSpent).toBe(0);
      expect(summary.stats.totalBudgeted).toBe(120);
    });
  });
});
