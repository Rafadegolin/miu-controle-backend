import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebsocketService } from '../websocket/websocket.service';
import { WS_EVENTS } from '../websocket/events/websocket.events';
import { CacheService } from '../common/services/cache.service';
import {
  ProjectStatus,
  ProjectItemStatus,
  QuoteStatus,
  TransactionType,
  TransactionStatus,
  TransactionSource,
  Prisma,
} from '@prisma/client';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateProjectItemDto } from './dto/create-project-item.dto';
import { UpdateProjectItemDto } from './dto/update-project-item.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { ConvertQuoteDto } from './dto/convert-quote.dto';

// ─── Seletor compartilhado para Quote ──────────────────────────────────────────
const QUOTE_SELECT = {
  id: true,
  supplierName: true,
  price: true,
  additionalCosts: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─── Seletor compartilhado para ProjectItem ─────────────────────────────────
const ITEM_SELECT = {
  id: true,
  name: true,
  description: true,
  quantity: true,
  status: true,
  priority: true,
  transactionId: true,
  createdAt: true,
  updatedAt: true,
  quotes: { select: QUOTE_SELECT, orderBy: { createdAt: 'asc' as const } },
} as const;

// ─── Seletor compartilhado para Project ──────────────────────────────────────
const PROJECT_SELECT = {
  id: true,
  userId: true,
  name: true,
  description: true,
  status: true,
  totalBudget: true,
  deadline: true,
  color: true,
  icon: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { items: true } },
} as const;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketService: WebsocketService,
    private readonly cacheService: CacheService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  PROJECTS
  // ═══════════════════════════════════════════════════════════════

  async createProject(userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        totalBudget: dto.totalBudget,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        color: dto.color ?? '#6366F1',
        icon: dto.icon,
        status: ProjectStatus.PLANNING,
      },
      select: { ...PROJECT_SELECT, items: { select: ITEM_SELECT } },
    });

    await this.cacheService.invalidateUserCache(userId);
    return project;
  }

  async findAllProjects(userId: string, status?: ProjectStatus) {
    return this.prisma.project.findMany({
      where: { userId, ...(status && { status }) },
      select: PROJECT_SELECT,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOneProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ...PROJECT_SELECT,
        items: {
          select: ITEM_SELECT,
          orderBy: [
            { priority: 'asc' as const },
            { createdAt: 'asc' as const },
          ],
        },
      },
    });

    this.assertOwner(project, userId, 'Projeto');
    return project;
  }

  async updateProject(
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
    await this.resolveProject(userId, projectId);

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.totalBudget !== undefined && { totalBudget: dto.totalBudget }),
        ...(dto.deadline !== undefined && {
          deadline: dto.deadline ? new Date(dto.deadline) : null,
        }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      select: { ...PROJECT_SELECT, items: { select: ITEM_SELECT } },
    });

    await this.cacheService.invalidateUserCache(userId);
    return updated;
  }

  async removeProject(userId: string, projectId: string) {
    await this.resolveProject(userId, projectId);

    await this.prisma.project.delete({ where: { id: projectId } });
    await this.cacheService.invalidateUserCache(userId);

    return { message: 'Projeto removido com sucesso' };
  }

  // ═══════════════════════════════════════════════════════════════
  //  SUMMARY — Dashboard de progresso
  // ═══════════════════════════════════════════════════════════════

  async getProjectSummary(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        items: {
          include: {
            quotes: true,
          },
        },
      },
    });

    this.assertOwner(project, userId, 'Projeto');

    const items = project.items;
    const totalItems = items.length;

    let totalBudgeted = 0; // soma dos orçamentos selecionados
    let totalSpent = 0; // soma das transações geradas
    let totalRejected = 0; // soma dos orçamentos rejeitados (para calcular economia)
    const purchasedItems: typeof items = [];
    const pendingItems: typeof items = [];
    const cancelledItems: typeof items = [];

    for (const item of items) {
      if (item.status === ProjectItemStatus.PURCHASED) {
        purchasedItems.push(item);
      } else if (item.status === ProjectItemStatus.CANCELLED) {
        cancelledItems.push(item);
      } else {
        pendingItems.push(item);
      }

      // Calcular orçamento selecionado do item
      const selectedQuote = item.quotes.find(
        (q) =>
          q.status === QuoteStatus.SELECTED ||
          q.status === QuoteStatus.CONVERTED,
      );
      if (selectedQuote) {
        const itemTotal =
          Number(selectedQuote.price) + Number(selectedQuote.additionalCosts);
        totalBudgeted += itemTotal;

        if (item.status === ProjectItemStatus.PURCHASED) {
          totalSpent += itemTotal;
        }
      }

      // Calcular soma dos orçamentos rejeitados
      for (const q of item.quotes) {
        if (q.status === QuoteStatus.REJECTED) {
          totalRejected += Number(q.price) + Number(q.additionalCosts);
        }
      }
    }

    // Economia = quanto seria gasto nos orçamentos rejeitados vs. o que foi realmente selecionado
    // (só conta para itens já comprados)
    let savingsVsRejected = 0;
    for (const item of purchasedItems) {
      const selectedQuote = item.quotes.find(
        (q) => q.status === QuoteStatus.CONVERTED,
      );
      if (!selectedQuote) continue;

      const selectedTotal =
        Number(selectedQuote.price) + Number(selectedQuote.additionalCosts);

      // Soma de tudo que foi rejeitado para esse item
      const rejectedTotal = item.quotes
        .filter((q) => q.status === QuoteStatus.REJECTED)
        .reduce(
          (acc, q) => acc + Number(q.price) + Number(q.additionalCosts),
          0,
        );

      // A "economia" é a diferença entre os rejeitados e o que foi pago
      savingsVsRejected += Math.max(0, rejectedTotal - selectedTotal);
    }

    const progressPercent =
      totalItems > 0
        ? Math.round(
            ((purchasedItems.length + cancelledItems.length) / totalItems) *
              100,
          )
        : 0;

    return {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        deadline: project.deadline,
        color: project.color,
        icon: project.icon,
        totalBudget: project.totalBudget ? Number(project.totalBudget) : null,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      stats: {
        totalItems,
        purchasedItems: purchasedItems.length,
        pendingItems: pendingItems.length,
        cancelledItems: cancelledItems.length,
        totalBudgeted: +totalBudgeted.toFixed(2),
        totalSpent: +totalSpent.toFixed(2),
        estimatedRemaining: +(totalBudgeted - totalSpent).toFixed(2),
        progressPercent,
        savingsVsRejected: +savingsVsRejected.toFixed(2),
        budgetVariance: project.totalBudget
          ? +(Number(project.totalBudget) - totalBudgeted).toFixed(2)
          : null,
      },
      items: items.map((item) => ({
        ...item,
        quotes: item.quotes.map((q) => ({
          ...q,
          price: Number(q.price),
          additionalCosts: Number(q.additionalCosts),
          total: +(Number(q.price) + Number(q.additionalCosts)).toFixed(2),
        })),
      })),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  PROJECT ITEMS
  // ═══════════════════════════════════════════════════════════════

  async addItem(userId: string, projectId: string, dto: CreateProjectItemDto) {
    await this.resolveProject(userId, projectId);

    const item = await this.prisma.projectItem.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
        quantity: dto.quantity ?? 1,
        priority: dto.priority ?? 3,
        status: ProjectItemStatus.PENDING,
      },
      select: ITEM_SELECT,
    });

    return item;
  }

  async updateItem(
    userId: string,
    projectId: string,
    itemId: string,
    dto: UpdateProjectItemDto,
  ) {
    await this.resolveItem(userId, projectId, itemId);

    const updated = await this.prisma.projectItem.update({
      where: { id: itemId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        // Não permite alterar para PURCHASED via PATCH -> use /convert
        ...(dto.status !== undefined &&
          dto.status !== ProjectItemStatus.PURCHASED && {
            status: dto.status,
          }),
      },
      select: ITEM_SELECT,
    });

    return updated;
  }

  async removeItem(userId: string, projectId: string, itemId: string) {
    await this.resolveItem(userId, projectId, itemId);

    await this.prisma.projectItem.delete({ where: { id: itemId } });

    // Recalcular status do projeto após remoção
    await this.syncProjectStatus(projectId);

    return { message: 'Item removido com sucesso' };
  }

  // ═══════════════════════════════════════════════════════════════
  //  QUOTES
  // ═══════════════════════════════════════════════════════════════

  async addQuote(
    userId: string,
    projectId: string,
    itemId: string,
    dto: CreateQuoteDto,
  ) {
    const item = await this.resolveItem(userId, projectId, itemId);

    if (item.status === ProjectItemStatus.PURCHASED) {
      throw new ConflictException(
        'Não é possível adicionar cotação a um item já comprado',
      );
    }

    const quote = await this.prisma.quote.create({
      data: {
        itemId,
        supplierName: dto.supplierName,
        price: dto.price,
        additionalCosts: dto.additionalCosts ?? 0,
        notes: dto.notes,
        status: QuoteStatus.PENDING,
      },
      select: QUOTE_SELECT,
    });

    // Ao adicionar a primeira cotação, item passa para QUOTED
    if (item.status === ProjectItemStatus.PENDING) {
      await this.prisma.projectItem.update({
        where: { id: itemId },
        data: { status: ProjectItemStatus.QUOTED },
      });
    }

    return {
      ...quote,
      price: Number(quote.price),
      additionalCosts: Number(quote.additionalCosts),
      total: +(Number(quote.price) + Number(quote.additionalCosts)).toFixed(2),
    };
  }

  async updateQuote(
    userId: string,
    projectId: string,
    itemId: string,
    quoteId: string,
    dto: UpdateQuoteDto,
  ) {
    const quote = await this.resolveQuote(userId, projectId, itemId, quoteId);

    if (quote.status === QuoteStatus.CONVERTED) {
      throw new ConflictException(
        'Não é possível editar uma cotação já convertida em transação',
      );
    }

    const updated = await this.prisma.quote.update({
      where: { id: quoteId },
      data: {
        ...(dto.supplierName !== undefined && {
          supplierName: dto.supplierName,
        }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.additionalCosts !== undefined && {
          additionalCosts: dto.additionalCosts,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      select: QUOTE_SELECT,
    });

    return {
      ...updated,
      price: Number(updated.price),
      additionalCosts: Number(updated.additionalCosts),
      total: +(Number(updated.price) + Number(updated.additionalCosts)).toFixed(
        2,
      ),
    };
  }

  async removeQuote(
    userId: string,
    projectId: string,
    itemId: string,
    quoteId: string,
  ) {
    const quote = await this.resolveQuote(userId, projectId, itemId, quoteId);

    if (quote.status === QuoteStatus.CONVERTED) {
      throw new ConflictException(
        'Não é possível remover uma cotação já convertida em transação',
      );
    }

    await this.prisma.quote.delete({ where: { id: quoteId } });

    // Se não há mais cotações, item volta para PENDING
    const remaining = await this.prisma.quote.count({ where: { itemId } });
    if (remaining === 0) {
      await this.prisma.projectItem.update({
        where: { id: itemId },
        data: { status: ProjectItemStatus.PENDING },
      });
    }

    return { message: 'Cotação removida com sucesso' };
  }

  // ─── Selecionar orçamento (desmarca automaticamente os outros do item) ──────

  async selectQuote(
    userId: string,
    projectId: string,
    itemId: string,
    quoteId: string,
  ) {
    const quote = await this.resolveQuote(userId, projectId, itemId, quoteId);

    if (quote.status === QuoteStatus.CONVERTED) {
      throw new ConflictException(
        'Esta cotação já foi convertida em transação',
      );
    }

    // Transação atômica: desmarcar todos → marcar o escolhido
    const [, selected] = await this.prisma.$transaction([
      // 1. Todas as SELECTED/REJECTED do item voltam para PENDING
      this.prisma.quote.updateMany({
        where: {
          itemId,
          id: { not: quoteId },
          status: { in: [QuoteStatus.SELECTED, QuoteStatus.PENDING] },
        },
        data: { status: QuoteStatus.PENDING },
      }),
      // 2. Marcar a cotação escolhida como SELECTED
      this.prisma.quote.update({
        where: { id: quoteId },
        data: { status: QuoteStatus.SELECTED },
        select: QUOTE_SELECT,
      }),
    ]);

    return {
      ...selected,
      price: Number(selected.price),
      additionalCosts: Number(selected.additionalCosts),
      total: +(
        Number(selected.price) + Number(selected.additionalCosts)
      ).toFixed(2),
    };
  }

  // ─── Rejeitar cotação ──────────────────────────────────────────────────────

  async rejectQuote(
    userId: string,
    projectId: string,
    itemId: string,
    quoteId: string,
  ) {
    const quote = await this.resolveQuote(userId, projectId, itemId, quoteId);

    if (quote.status === QuoteStatus.CONVERTED) {
      throw new ConflictException(
        'Esta cotação já foi convertida em transação',
      );
    }

    const updated = await this.prisma.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.REJECTED },
      select: QUOTE_SELECT,
    });

    return {
      ...updated,
      price: Number(updated.price),
      additionalCosts: Number(updated.additionalCosts),
      total: +(Number(updated.price) + Number(updated.additionalCosts)).toFixed(
        2,
      ),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  CONVERT — Cotação selecionada → Transação real
  // ═══════════════════════════════════════════════════════════════

  async convertQuote(
    userId: string,
    projectId: string,
    itemId: string,
    dto: ConvertQuoteDto,
  ) {
    // 1. Validar contexto completo
    const item = await this.resolveItem(userId, projectId, itemId);
    const project = item['project'] as { name: string } | undefined;

    if (item.status === ProjectItemStatus.PURCHASED) {
      throw new ConflictException('Este item já foi comprado anteriormente');
    }

    // 2. Buscar cotação selecionada
    const selectedQuote = await this.prisma.quote.findFirst({
      where: { itemId, status: QuoteStatus.SELECTED },
    });

    if (!selectedQuote) {
      throw new UnprocessableEntityException(
        'Selecione uma cotação antes de converter. Use PATCH .../quotes/:id/select',
      );
    }

    // 3. Validar que a conta existe e pertence ao usuário
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }
    if (account.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para usar esta conta',
      );
    }

    // 4. Validar categoria (se fornecida) — deve ser do tipo EXPENSE
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Categoria não encontrada');
      }
      if (category.type !== 'EXPENSE') {
        throw new UnprocessableEntityException(
          'Apenas categorias do tipo EXPENSE podem ser usadas em conversões',
        );
      }
    }

    const totalAmount =
      Number(selectedQuote.price) + Number(selectedQuote.additionalCosts);

    // 5. Executar tudo em uma transação de banco
    const result = await this.prisma.$transaction(async (tx) => {
      // 5a. Criar transaction financeira
      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId: dto.accountId,
          categoryId: dto.categoryId ?? null,
          type: TransactionType.EXPENSE,
          amount: totalAmount,
          description: `[Projeto] ${item.name}`,
          notes: dto.notes
            ? dto.notes
            : `Projeto: ${item.name} — Fornecedor: ${selectedQuote.supplierName}`,
          date: dto.date ? new Date(dto.date) : new Date(),
          status: TransactionStatus.COMPLETED,
          source: TransactionSource.MANUAL,
          tags: ['projeto'],
          isRecurring: false,
        },
        include: {
          category: { select: { id: true, name: true, color: true } },
          account: { select: { id: true, name: true, type: true } },
        },
      });

      // 5b. Atualizar saldo da conta
      await tx.account.update({
        where: { id: dto.accountId },
        data: {
          currentBalance: {
            decrement: new Prisma.Decimal(totalAmount),
          },
        },
      });

      // 5c. Marcar cotação como CONVERTED
      await tx.quote.update({
        where: { id: selectedQuote.id },
        data: { status: QuoteStatus.CONVERTED },
      });

      // 5d. Marcar item como PURCHASED com referência à transação
      const updatedItem = await tx.projectItem.update({
        where: { id: itemId },
        data: {
          status: ProjectItemStatus.PURCHASED,
          transactionId: transaction.id,
        },
        select: ITEM_SELECT,
      });

      return { transaction, item: updatedItem };
    });

    // 6. Atualizar status do projeto (se todos itens estiverem concluídos)
    const newProjectStatus = await this.syncProjectStatus(projectId);

    // 7. Emitir evento WebSocket
    this.websocketService.emitToUser(userId, WS_EVENTS.BALANCE_UPDATED, {
      accountId: dto.accountId,
      newBalance: Number(account.currentBalance) - totalAmount,
      difference: -totalAmount,
    });

    this.logger.log(
      `Project item converted: item=${itemId}, transaction=${result.transaction.id}, amount=${totalAmount}`,
    );

    await this.cacheService.invalidateUserCache(userId);

    return {
      transaction: result.transaction,
      item: result.item,
      projectStatus: newProjectStatus,
      totalConverted: +totalAmount.toFixed(2),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  //  HELPERS PRIVADOS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Resolve um projeto validando a propriedade.
   * Lança NotFoundException tanto se não existe quanto se é de outro usuário
   * (nunca revelamos ao chamador que o recurso existe mas pertence a outro).
   */
  private async resolveProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true, name: true, status: true },
    });

    this.assertOwner(project, userId, 'Projeto');
    return project!;
  }

  /**
   * Resolve um item validando a cadeia project → item → owner.
   */
  private async resolveItem(userId: string, projectId: string, itemId: string) {
    const item = await this.prisma.projectItem.findUnique({
      where: { id: itemId },
      include: {
        project: { select: { id: true, userId: true, name: true } },
        quotes: { select: QUOTE_SELECT },
      },
    });

    if (!item || item.projectId !== projectId) {
      throw new NotFoundException('Item não encontrado');
    }
    if (item.project.userId !== userId) {
      throw new NotFoundException('Item não encontrado');
    }

    return item;
  }

  /**
   * Resolve uma cotação validando a cadeia project → item → quote → owner.
   */
  private async resolveQuote(
    userId: string,
    projectId: string,
    itemId: string,
    quoteId: string,
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        item: {
          include: {
            project: { select: { id: true, userId: true } },
          },
        },
      },
    });

    if (
      !quote ||
      quote.itemId !== itemId ||
      quote.item.projectId !== projectId
    ) {
      throw new NotFoundException('Cotação não encontrada');
    }
    if (quote.item.project.userId !== userId) {
      throw new NotFoundException('Cotação não encontrada');
    }

    return quote;
  }

  /**
   * Lança NotFoundException se o recurso não existe ou userId não bate.
   */
  private assertOwner(
    resource: { userId: string } | null | undefined,
    userId: string,
    entityName: string,
  ): asserts resource is NonNullable<typeof resource> {
    if (!resource || resource.userId !== userId) {
      throw new NotFoundException(`${entityName} não encontrado`);
    }
  }

  /**
   * Recalcula e persiste o ProjectStatus com base nos itens atuais.
   * Regras:
   *   - Sem itens não-cancelados → PLANNING
   *   - Todos os itens não-cancelados PURCHASED → COMPLETED
   *   - Ao menos 1 PURCHASED → IN_PROGRESS
   *   - Caso contrário → PLANNING
   */
  private async syncProjectStatus(projectId: string): Promise<ProjectStatus> {
    const items = await this.prisma.projectItem.findMany({
      where: { projectId },
      select: { status: true },
    });

    const active = items.filter(
      (i) => i.status !== ProjectItemStatus.CANCELLED,
    );

    let newStatus: ProjectStatus;

    if (active.length === 0) {
      newStatus = ProjectStatus.PLANNING;
    } else if (active.every((i) => i.status === ProjectItemStatus.PURCHASED)) {
      newStatus = ProjectStatus.COMPLETED;
    } else if (active.some((i) => i.status === ProjectItemStatus.PURCHASED)) {
      newStatus = ProjectStatus.IN_PROGRESS;
    } else {
      newStatus = ProjectStatus.PLANNING;
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: newStatus },
    });

    return newStatus;
  }
}
