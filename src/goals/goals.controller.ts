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
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { ContributeGoalDto } from './dto/contribute-goal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoalStatus } from '@prisma/client';

@ApiTags('Objetivos (Potes)')
@Controller('goals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar novo objetivo' })
  create(@CurrentUser() user, @Body() createGoalDto: CreateGoalDto) {
    return this.goalsService.create(user.id, createGoalDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os objetivos' })
  @ApiQuery({ name: 'status', enum: GoalStatus, required: false })
  findAll(@CurrentUser() user, @Query('status') status?: GoalStatus) {
    return this.goalsService.findAll(user.id, status);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumo geral dos objetivos' })
  getSummary(@CurrentUser() user) {
    return this.goalsService.getSummary(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar objetivo por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.goalsService.findOne(id, user.id);
  }

  @Post(':id/contribute')
  @ApiOperation({ summary: 'Contribuir para objetivo' })
  contribute(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body() contributeDto: ContributeGoalDto,
  ) {
    return this.goalsService.contribute(id, user.id, contributeDto);
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Retirar valor do objetivo' })
  withdraw(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body() body: { amount: number },
  ) {
    return this.goalsService.withdraw(id, user.id, body.amount);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar objetivo' })
  update(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body() updateGoalDto: UpdateGoalDto,
  ) {
    return this.goalsService.update(id, user.id, updateGoalDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deletar objetivo' })
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.goalsService.remove(id, user.id);
  }
}
