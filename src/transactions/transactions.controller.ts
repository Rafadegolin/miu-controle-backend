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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { FilterTransactionDto } from './dto/filter-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CorrectCategoryDto } from '../ai/dto/correct-category.dto';

@ApiTags('Transações')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @Throttle({ medium: { limit: 60, ttl: 60000 } }) // 60 req/min
  @ApiOperation({ 
    summary: 'Criar nova transação',
    description: 'Limite: 60 transações por minuto'
  })
  create(
    @CurrentUser() user,
    @Body() createTransactionDto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(user.id, createTransactionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar transações com filtros' })
  findAll(@CurrentUser() user, @Query() filters: FilterTransactionDto) {
    return this.transactionsService.findAll(user.id, filters);
  }

  @Get('stats/monthly')
  @ApiOperation({ summary: 'Estatísticas mensais' })
  @ApiQuery({ name: 'month', example: '2025-11-01' })
  getMonthlyStats(@CurrentUser() user, @Query('month') month: string) {
    return this.transactionsService.getMonthlyStats(user.id, month);
  }

  @Get('stats/category/:categoryId')
  @ApiOperation({ summary: 'Estatísticas por categoria' })
  getCategoryStats(
    @CurrentUser() user,
    @Param('categoryId') categoryId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.transactionsService.getCategoryStats(
      user.id,
      categoryId,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar transação por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.transactionsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar transação' })
  update(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(id, user.id, updateTransactionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deletar transação' })
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.transactionsService.remove(id, user.id);
  }

  /**
   * 🤖 AI FEEDBACK: Corrigir categoria sugerida pela IA
   */
  @Post(':id/correct-category')
  @ApiOperation({
    summary: 'Corrigir categoria AI',
    description:
      'Permite corrigir a categoria sugerida pela IA, gerando feedback para melhorar o modelo',
  })
  correctCategory(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body() correctCategoryDto: CorrectCategoryDto,
  ) {
    return this.transactionsService.correctCategory(
      id,
      user.id,
      correctCategoryDto.correctedCategoryId,
    );
  }
}
