import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { RecurringTransactionsService } from './recurring-transactions.service';
import { CreateRecurringTransactionDto } from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';
import { FilterRecurringTransactionDto } from './dto/filter-recurring-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Transações Recorrentes')
@Controller('recurring-transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecurringTransactionsController {
  constructor(
    private readonly recurringTransactionsService: RecurringTransactionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar transação recorrente' })
  @ApiResponse({ status: 201, description: 'Transação recorrente criada' })
  create(
    @CurrentUser() user: any,
    @Body() createDto: CreateRecurringTransactionDto,
  ) {
    return this.recurringTransactionsService.create(user.id, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar transações recorrentes' })
  @ApiResponse({ status: 200, description: 'Lista de transações recorrentes' })
  findAll(
    @CurrentUser() user: any,
    @Query() filters: FilterRecurringTransactionDto,
  ) {
    return this.recurringTransactionsService.findAll(user.id, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar transação recorrente por ID' })
  @ApiResponse({ status: 200, description: 'Transação recorrente encontrada' })
  @ApiResponse({
    status: 404,
    description: 'Transação recorrente não encontrada',
  })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.recurringTransactionsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar transação recorrente' })
  @ApiResponse({ status: 200, description: 'Transação recorrente atualizada' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateRecurringTransactionDto,
  ) {
    return this.recurringTransactionsService.update(id, user.id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deletar transação recorrente' })
  @ApiResponse({ status: 200, description: 'Transação recorrente deletada' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.recurringTransactionsService.remove(id, user.id);
  }

  @Post(':id/toggle-active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativar/desativar transação recorrente' })
  @ApiResponse({ status: 200, description: 'Status alterado' })
  toggleActive(@CurrentUser() user: any, @Param('id') id: string) {
    return this.recurringTransactionsService.toggleActive(id, user.id);
  }

  @Post(':id/process-now')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Processar recorrência manualmente (gerar transação agora)',
  })
  @ApiResponse({ status: 200, description: 'Transação gerada' })
  processNow(@CurrentUser() user: any, @Param('id') id: string) {
    return this.recurringTransactionsService.processNow(id, user.id);
  }
}
