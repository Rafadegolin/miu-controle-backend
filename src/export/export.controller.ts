import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ExportService } from './export.service';
import { ExportFiltersDto } from './dto/export-filters.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Exportação')
@Controller('export')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('csv')
  @Throttle({ long: { limit: 10, ttl: 3600000 } }) // 10 req/hora
  @ApiOperation({ 
    summary: 'Exportar transações em CSV',
    description: 'Limite: 10 exportações por hora'
  })
  @ApiResponse({ status: 200, description: 'Arquivo CSV gerado' })
  async exportCSV(
    @CurrentUser() user: any,
    @Query() filters: ExportFiltersDto,
    @Res() res: Response,
  ) {
    const csv = await this.exportService.exportCSV(user.id, filters);

    const filename = `transacoes_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(HttpStatus.OK).send('\uFEFF' + csv); // BOM para UTF-8
  }

  @Get('excel')
  @Throttle({ long: { limit: 10, ttl: 3600000 } }) // 10 req/hora
  @ApiOperation({ 
    summary: 'Exportar transações em Excel',
    description: 'Limite: 10 exportações por hora'
  })
  @ApiResponse({ status: 200, description: 'Arquivo Excel gerado' })
  async exportExcel(
    @CurrentUser() user: any,
    @Query() filters: ExportFiltersDto,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.exportExcel(user.id, filters);

    const filename = `transacoes_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(HttpStatus.OK).send(buffer);
  }

  @Get('pdf')
  @Throttle({ long: { limit: 10, ttl: 3600000 } }) // 10 req/hora
  @ApiOperation({ 
    summary: 'Exportar transações em PDF',
    description: 'Limite: 10 exportações por hora'
  })
  @ApiResponse({ status: 200, description: 'Arquivo PDF gerado' })
  async exportPDF(
    @CurrentUser() user: any,
    @Query() filters: ExportFiltersDto,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.exportPDF(user.id, filters);

    const filename = `transacoes_${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(HttpStatus.OK).send(buffer);
  }
}
