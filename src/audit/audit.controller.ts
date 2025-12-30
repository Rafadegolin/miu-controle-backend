import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { FilterAuditDto } from './dto/filter-audit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditEntity } from '../common/enums/audit-entity.enum';

@ApiTags('Auditoria')
@Controller('audit')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Buscar logs de auditoria do usuário autenticado',
    description:
      'Retorna histórico de todas as operações realizadas pelo usuário logado. ' +
      'Suporta filtros por data, ação e entidade. Usa paginação cursor-based.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de logs retornada com sucesso',
    schema: {
      example: {
        items: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            userId: '123e4567-e89b-12d3-a456-426614174000',
            action: 'CREATE',
            entity: 'TRANSACTION',
            entityId: '789e4567-e89b-12d3-a456-426614174111',
            before: null,
            after: {
              id: '789e4567-e89b-12d3-a456-426614174111',
              amount: 100.0,
              description: 'Compra no supermercado',
            },
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0...',
            createdAt: '2025-12-30T03:30:00.000Z',
          },
        ],
        nextCursor: '550e8400-e29b-41d4-a716-446655440001',
        hasMore: true,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async getMyAuditLogs(
    @CurrentUser() user: any,
    @Query() filters: FilterAuditDto,
  ) {
    return this.auditService.getUserAuditLogs(user.id, filters);
  }

  @Get('entity/:entity/:entityId')
  @ApiOperation({
    summary: 'Buscar histórico de uma entidade específica',
    description:
      'Retorna todo o histórico de mudanças de uma entidade (transação, conta, meta, etc). ' +
      'Útil para ver "quem alterou o quê" e reconstruir o histórico completo.',
  })
  @ApiParam({
    name: 'entity',
    enum: AuditEntity,
    description: 'Tipo da entidade',
    example: 'TRANSACTION',
  })
  @ApiParam({
    name: 'entityId',
    description: 'ID da entidade',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Histórico da entidade retornado',
    schema: {
      example: {
        items: [
          {
            id: '550e8400-e29b-41d4-a716-446655440002',
            userId: '123e4567-e89b-12d3-a456-426614174000',
            action: 'UPDATE',
            entity: 'TRANSACTION',
            entityId: '789e4567-e89b-12d3-a456-426614174111',
            before: { amount: 100.0, description: 'Compra no supermercado' },
            after: { amount: 150.0, description: 'Compra no supermercado (atualizado)' },
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0...',
            createdAt: '2025-12-30T04:00:00.000Z',
            user: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'user@example.com',
              fullName: 'João Silva',
            },
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async getEntityAuditLogs(
    @Param('entity') entity: AuditEntity,
    @Param('entityId') entityId: string,
    @Query() filters: FilterAuditDto,
  ) {
    return this.auditService.getEntityAuditLogs(entity, entityId, filters);
  }
}
