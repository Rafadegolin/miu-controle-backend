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
  ApiQuery,
} from '@nestjs/swagger';
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Moedas')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar moeda (Admin)' })
  @ApiResponse({ status: 201, description: 'Moeda criada' })
  create(@Body() createCurrencyDto: CreateCurrencyDto) {
    return this.currenciesService.create(createCurrencyDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar moedas' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Lista de moedas' })
  findAll(@Query('activeOnly') activeOnly?: string) {
    const active = activeOnly === 'false' ? false : true;
    return this.currenciesService.findAll(active);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar moeda por ID' })
  @ApiResponse({ status: 200, description: 'Moeda encontrada' })
  @ApiResponse({ status: 404, description: 'Moeda não encontrada' })
  findOne(@Param('id') id: string) {
    return this.currenciesService.findOne(id);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Buscar moeda por código (ex: USD, BRL)' })
  @ApiResponse({ status: 200, description: 'Moeda encontrada' })
  findByCode(@Param('code') code: string) {
    return this.currenciesService.findByCode(code);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar moeda (Admin)' })
  @ApiResponse({ status: 200, description: 'Moeda atualizada' })
  update(
    @Param('id') id: string,
    @Body() updateCurrencyDto: UpdateCurrencyDto,
  ) {
    return this.currenciesService.update(id, updateCurrencyDto);
  }

  @Post(':id/toggle-active')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativar/desativar moeda (Admin)' })
  @ApiResponse({ status: 200, description: 'Status alterado' })
  toggleActive(@Param('id') id: string) {
    return this.currenciesService.toggleActive(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deletar moeda (Admin)' })
  @ApiResponse({ status: 200, description: 'Moeda deletada' })
  remove(@Param('id') id: string) {
    return this.currenciesService.remove(id);
  }
}
