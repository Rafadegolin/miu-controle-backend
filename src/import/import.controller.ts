import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { ImportService } from './import.service';
import { ImportPreviewDto } from './dto/import-preview.dto';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import 'multer';

@ApiTags('Importação de Extratos')
@Controller('import')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /**
   * 📥 Lê um arquivo OFX/CSV e devolve um preview — NÃO salva.
   */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 20, ttl: 60000 } }) // 20 req/min
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Pré-visualizar importação de extrato (OFX/CSV)',
    description:
      'Envia um arquivo de extrato (OFX ou CSV) e retorna as transações extraídas ' +
      'para o usuário revisar. NÃO salva nada. Para CSV, informe o mapeamento de ' +
      'colunas (dateColumn, amountColumn, descriptionColumn) e os separadores.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'format'],
      properties: {
        file: { type: 'string', format: 'binary' },
        format: { type: 'string', enum: ['OFX', 'CSV'] },
        delimiter: { type: 'string', example: ';' },
        decimalSeparator: { type: 'string', example: ',' },
        dateFormat: { type: 'string', example: 'DD/MM/YYYY' },
        hasHeader: { type: 'boolean', example: true },
        dateColumn: { type: 'string', example: 'Data' },
        amountColumn: { type: 'string', example: 'Valor' },
        descriptionColumn: { type: 'string', example: 'Descrição' },
        typeColumn: { type: 'string', example: 'Tipo' },
      },
    },
  })
  preview(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportPreviewDto,
  ) {
    return this.importService.preview(file, dto);
  }

  /**
   * 📥 Persiste as transações confirmadas (source=IMPORTED).
   */
  @Post('confirm')
  @Throttle({ medium: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Confirmar e salvar transações importadas',
    description:
      'Persiste em lote as transações revisadas pelo usuário com source=IMPORTED. ' +
      'Duplicatas (mesma conta+data+valor+tipo+descrição) são ignoradas.',
  })
  confirm(@CurrentUser() user, @Body() dto: ConfirmImportDto) {
    return this.importService.confirm(user.id, dto);
  }
}
