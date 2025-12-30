import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilterAuditDto } from './dto/filter-audit.dto';
import { AuditAction } from '../common/enums/audit-action.enum';
import { AuditEntity } from '../common/enums/audit-entity.enum';
import { Prisma } from '@prisma/client';

interface LogParams {
  userId?: string;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  before?: any;
  after?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Criar log de auditoria de forma assíncrona (não bloqueia a operação principal)
   */
  async log(params: LogParams): Promise<void> {
    try {
      // Executar de forma assíncrona sem bloquear
      Promise.resolve().then(async () => {
        await this.prisma.auditLog.create({
          data: {
            userId: params.userId,
            action: params.action,
            entity: params.entity,
            entityId: params.entityId,
            before: params.before || null,
            after: params.after || null,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
          },
        });
      }).catch((error) => {
        // Log de auditoria não deve quebrar a aplicação
        console.error('❌ Erro ao criar log de auditoria:', error.message);
      });
    } catch (error) {
      // Capturar erros silenciosamente
      console.error('❌ Erro ao criar log de auditoria:', error.message);
    }
  }

  /**
   * Buscar logs de um usuário específico
   */
  async getUserAuditLogs(userId: string, filters: FilterAuditDto) {
    const take = filters.take || 50;
    const cursor = filters.cursor;

    const where: Prisma.AuditLogWhereInput = {
      userId,
      ...(filters.action && { action: filters.action }),
      ...(filters.entity && { entity: filters.entity }),
    };

    // Filtro de data
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    // Buscar take + 1 para saber se há mais itens
    const logs = await this.prisma.auditLog.findMany({
      where,
      take: take + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      orderBy: {
        createdAt: 'desc',
      },
    });

    const hasMore = logs.length > take;
    const items = hasMore ? logs.slice(0, take) : logs;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Buscar logs de uma entidade específica
   */
  async getEntityAuditLogs(
    entity: AuditEntity,
    entityId: string,
    filters: FilterAuditDto,
  ) {
    const take = filters.take || 50;
    const cursor = filters.cursor;

    const where: Prisma.AuditLogWhereInput = {
      entity,
      entityId,
      ...(filters.action && { action: filters.action }),
    };

    // Filtro de data
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    // Buscar take + 1 para saber se há mais itens
    const logs = await this.prisma.auditLog.findMany({
      where,
      take: take + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const hasMore = logs.length > take;
    const items = hasMore ? logs.slice(0, take) : logs;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Buscar todos os logs (admin only)
   */
  async getAdminAuditLogs(filters: FilterAuditDto) {
    const take = filters.take || 50;
    const cursor = filters.cursor;

    const where: Prisma.AuditLogWhereInput = {
      ...(filters.action && { action: filters.action }),
      ...(filters.entity && { entity: filters.entity }),
    };

    // Filtro de data
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    // Buscar take + 1 para saber se há mais itens
    const logs = await this.prisma.auditLog.findMany({
      where,
      take: take + 1,
      ...(cursor && {
        skip: 1,
        cursor: { id: cursor },
      }),
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const hasMore = logs.length > take;
    const items = hasMore ? logs.slice(0, take) : logs;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }
}
