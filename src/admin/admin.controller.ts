import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('slow-queries')
  @ApiOperation({
    summary: 'Listar queries lentas para monitoramento',
    description:
      'Retorna as últimas 100 queries que demoraram mais de 200ms. Endpoint para administradores.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de queries lentas',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          query: { type: 'string', example: 'Transaction.findMany' },
          params: { type: 'string', example: '{"where":{"userId":"123"}}' },
          duration: { type: 'number', example: 345 },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  getSlowQueries() {
    return this.prisma.getSlowQueries();
  }
}
