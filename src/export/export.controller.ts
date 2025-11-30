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
  @ApiOperation({ summary: 'Exportar transações em CSV' })
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
  @ApiOperation({ summary: 'Exportar transações em Excel' })
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
  @ApiOperation({ summary: 'Exportar transações em PDF' })
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
