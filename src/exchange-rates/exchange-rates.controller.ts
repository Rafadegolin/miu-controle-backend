import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  Query,
  UseGuards,
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
import { ExchangeRatesService } from './exchange-rates.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { ConvertCurrencyDto } from './dto/convert-currency.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Taxas de Câmbio')
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar taxa de câmbio manualmente (Admin)' })
  @ApiResponse({ status: 201, description: 'Taxa criada' })
  create(@Body() createDto: CreateExchangeRateDto) {
    return this.exchangeRatesService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar taxas de câmbio' })
  @ApiQuery({ name: 'fromCurrency', required: false, example: 'USD' })
  @ApiQuery({ name: 'toCurrency', required: false, example: 'BRL' })
  @ApiResponse({ status: 200, description: 'Lista de taxas' })
  findAll(
    @Query('fromCurrency') fromCurrency?: string,
    @Query('toCurrency') toCurrency?: string,
  ) {
    return this.exchangeRatesService.findAll(fromCurrency, toCurrency);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Buscar taxa de câmbio mais recente' })
  @ApiQuery({ name: 'from', required: true, example: 'USD' })
  @ApiQuery({ name: 'to', required: true, example: 'BRL' })
  @ApiResponse({ status: 200, description: 'Taxa mais recente' })
  getLatestRate(@Query('from') from: string, @Query('to') to: string) {
    return this.exchangeRatesService.getLatestRate(from, to);
  }

  @Post('convert')
  @ApiOperation({ summary: 'Converter valor entre moedas' })
  @ApiResponse({ status: 200, description: 'Conversão realizada' })
  convert(@Body() convertDto: ConvertCurrencyDto) {
    return this.exchangeRatesService.convert(convertDto);
  }

  @Get('consolidate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consolidar saldos de todas as contas na moeda preferida',
  })
  @ApiResponse({ status: 200, description: 'Saldos consolidados' })
  consolidateBalance(@CurrentUser() user: any) {
    return this.exchangeRatesService.consolidateBalance(user.id);
  }

  @Post('update-rates')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atualizar taxas de câmbio manualmente (Admin)' })
  @ApiResponse({ status: 200, description: 'Taxas atualizadas' })
  updateRates() {
    return this.exchangeRatesService.updateExchangeRates();
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deletar taxa de câmbio (Admin)' })
  @ApiResponse({ status: 200, description: 'Taxa deletada' })
  remove(@Param('id') id: string) {
    return this.exchangeRatesService.remove(id);
  }
}
