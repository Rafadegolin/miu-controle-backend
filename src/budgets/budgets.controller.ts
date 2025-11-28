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
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BudgetPeriod } from '@prisma/client';

@ApiTags('Orçamentos')
@Controller('budgets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar novo orçamento' })
  create(@CurrentUser() user, @Body() createBudgetDto: CreateBudgetDto) {
    return this.budgetsService.create(user.id, createBudgetDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os orçamentos' })
  @ApiQuery({ name: 'period', enum: BudgetPeriod, required: false })
  findAll(@CurrentUser() user, @Query('period') period?: BudgetPeriod) {
    return this.budgetsService.findAll(user.id, period);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumo de orçamentos do mês' })
  @ApiQuery({ name: 'month', required: false, example: '2025-11-01' })
  getSummary(@CurrentUser() user, @Query('month') month?: string) {
    return this.budgetsService.getSummary(user.id, month);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar orçamento por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.budgetsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar orçamento' })
  update(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body() updateBudgetDto: UpdateBudgetDto,
  ) {
    return this.budgetsService.update(id, user.id, updateBudgetDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deletar orçamento' })
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.budgetsService.remove(id, user.id);
  }
}
