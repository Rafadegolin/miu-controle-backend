import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../enums/audit-action.enum';
import { AuditEntity } from '../enums/audit-entity.enum';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Interceptor para capturar automaticamente operações críticas e criar logs de auditoria
 * 
 * Captura:
 * - POST, PATCH, DELETE em rotas auditáveis
 * - Dados do usuário (userId do JWT)
 * - IP e User-Agent
 * - Snapshot before/after de mudanças
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private auditService: AuditService,
    private prisma: PrismaService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const user = request.user;
    const ipAddress = request.ip || request.socket?.remoteAddress;
    const userAgent = request.headers['user-agent'];

    // Verificar se a rota é auditável
    const auditInfo = this.getAuditInfo(method, url);
    if (!auditInfo) {
      return next.handle();
    }

    const { action, entity } = auditInfo;
    let entityId: string | undefined;
    let beforeState: any = null;

    // Para UPDATE e DELETE, capturar estado anterior
    if (
      (action === AuditAction.UPDATE || action === AuditAction.DELETE) &&
      auditInfo.entityId
    ) {
      entityId = auditInfo.entityId;
      beforeState = await this.getEntityState(entity, entityId);
    }

    // Executar operação principal
    return next.handle().pipe(
      tap(async (response) => {
        try {
          // Para CREATE, extrair entityId da resposta
          if (action === AuditAction.CREATE && response?.id) {
            entityId = response.id;
          }

          // Determinar estado posterior
          let afterState: any = null;
          if (action === AuditAction.CREATE || action === AuditAction.UPDATE) {
            afterState = response;
          }

          // Criar log de auditoria de forma assíncrona
          await this.auditService.log({
            userId: user?.id,
            action,
            entity,
            entityId,
            before: beforeState,
            after: afterState,
            ipAddress,
            userAgent,
          });
        } catch (error) {
          // Não bloquear a resposta se houver erro no log
          console.error('❌ Erro ao criar log de auditoria no interceptor:', error.message);
        }
      }),
    );
  }

  /**
   * Identifica se a rota é auditável e retorna informações de auditoria
   */
  private getAuditInfo(
    method: string,
    url: string,
  ): { action: AuditAction; entity: AuditEntity; entityId?: string } | null {
    // Remover query params
    const path = url.split('?')[0];

    // Extrair ID da URL se houver (para UPDATE/DELETE)
    const idMatch = path.match(/\/([a-f0-9-]{36})$/i);
    const entityId = idMatch ? idMatch[1] : undefined;

    // Mapear rotas para ações e entidades
    if (method === 'POST') {
      if (path.startsWith('/transactions') && !path.includes('/stats')) {
        return { action: AuditAction.CREATE, entity: AuditEntity.TRANSACTION };
      }
      if (path.startsWith('/accounts')) {
        return { action: AuditAction.CREATE, entity: AuditEntity.ACCOUNT };
      }
      if (path.startsWith('/budgets')) {
        return { action: AuditAction.CREATE, entity: AuditEntity.BUDGET };
      }
      if (path.startsWith('/goals')) {
        return { action: AuditAction.CREATE, entity: AuditEntity.GOAL };
      }
      if (path.startsWith('/categories')) {
        return { action: AuditAction.CREATE, entity: AuditEntity.CATEGORY };
      }
      if (path.startsWith('/recurring-transactions')) {
        return { action: AuditAction.CREATE, entity: AuditEntity.RECURRING_TRANSACTION };
      }
      if (path === '/auth/register') {
        return { action: AuditAction.REGISTER, entity: AuditEntity.USER };
      }
      if (path === '/auth/login') {
        return { action: AuditAction.LOGIN, entity: AuditEntity.USER };
      }
    }

    if (method === 'PATCH') {
      if (path.match(/^\/transactions\/[a-f0-9-]{36}$/i)) {
        return { action: AuditAction.UPDATE, entity: AuditEntity.TRANSACTION, entityId };
      }
      if (path.match(/^\/accounts\/[a-f0-9-]{36}$/i)) {
        return { action: AuditAction.UPDATE, entity: AuditEntity.ACCOUNT, entityId };
      }
      if (path.match(/^\/budgets\/[a-f0-9-]{36}$/i)) {
        return { action: AuditAction.UPDATE, entity: AuditEntity.BUDGET, entityId };
      }
      if (path.match(/^\/goals\/[a-f0-9-]{36}$/i)) {
        return { action: AuditAction.UPDATE, entity: AuditEntity.GOAL, entityId };
      }
      if (path.match(/^\/categories\/[a-f0-9-]{36}$/i)) {
        return { action: AuditAction.UPDATE, entity: AuditEntity.CATEGORY, entityId };
      }
      if (path.match(/^\/recurring-transactions\/[a-f0-9-]{36}$/i)) {
        return { action: AuditAction.UPDATE, entity: AuditEntity.RECURRING_TRANSACTION, entityId };
      }
    }

    if (method === 'DELETE') {
      if (path.match(/^\/transactions\/[a-f0-9-]{36}$/i)) {
        return { action: AuditAction.DELETE, entity: AuditEntity.TRANSACTION, entityId };
      }
      if (path.match(/^\/accounts\/[a-f0-9-]{36}$/i)) {
        return { action: AuditAction.DELETE, entity: AuditEntity.ACCOUNT, entityId };
      }
      if (path.match(/^\/budgets\/[a-f0-9-]{36}$/i)) {
        return { action: AuditAction.DELETE, entity: AuditEntity.BUDGET, entityId };
      }
      if (path.match(/^\/goals\/[a-f0-9-]{36}$/i)) {
        return { action: AuditAction.DELETE, entity: AuditEntity.GOAL, entityId };
      }
      if (path.match(/^\/categories\/[a-f0-9-]{36}$/i)) {
        return { action: AuditAction.DELETE, entity: AuditEntity.CATEGORY, entityId };
      }
      if (path.match(/^\/recurring-transactions\/[a-f0-9-]{36}$/i)) {
        return { action: AuditAction.DELETE, entity: AuditEntity.RECURRING_TRANSACTION, entityId };
      }
    }

    return null;
  }

  /**
   * Busca o estado atual de uma entidade no banco
   */
  private async getEntityState(
    entity: AuditEntity,
    entityId: string,
  ): Promise<any> {
    try {
      switch (entity) {
        case AuditEntity.TRANSACTION:
          return await this.prisma.transaction.findUnique({
            where: { id: entityId },
            include: { category: true, account: true },
          });
        case AuditEntity.ACCOUNT:
          return await this.prisma.account.findUnique({
            where: { id: entityId },
          });
        case AuditEntity.BUDGET:
          return await this.prisma.budget.findUnique({
            where: { id: entityId },
            include: { category: true },
          });
        case AuditEntity.GOAL:
          return await this.prisma.goal.findUnique({
            where: { id: entityId },
          });
        case AuditEntity.CATEGORY:
          return await this.prisma.category.findUnique({
            where: { id: entityId },
          });
        case AuditEntity.RECURRING_TRANSACTION:
          return await this.prisma.recurringTransaction.findUnique({
            where: { id: entityId },
            include: { category: true, account: true },
          });
        default:
          return null;
      }
    } catch (error) {
      console.error('❌ Erro ao buscar estado da entidade:', error.message);
      return null;
    }
  }
}
