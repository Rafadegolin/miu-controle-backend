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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Contas')
@Controller('accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar nova conta' })
  create(@CurrentUser() user, @Body() createAccountDto: CreateAccountDto) {
    return this.accountsService.create(user.id, createAccountDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as contas do usuário' })
  findAll(@CurrentUser() user, @Query('activeOnly') activeOnly?: string) {
    const onlyActive = activeOnly !== 'false'; // Default true
    return this.accountsService.findAll(user.id, onlyActive);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Obter saldo total e resumo das contas' })
  getBalance(@CurrentUser() user) {
    return this.accountsService.getBalance(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar conta por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.accountsService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar conta' })
  update(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body() updateAccountDto: UpdateAccountDto,
  ) {
    return this.accountsService.update(id, user.id, updateAccountDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desativar conta' })
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.accountsService.remove(id, user.id);
  }
}
