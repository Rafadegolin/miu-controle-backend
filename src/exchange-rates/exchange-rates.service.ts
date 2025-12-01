import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExchangeRateDto } from './dto/create-exchange-rate.dto';
import { ConvertCurrencyDto } from './dto/convert-currency.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Criar taxa de câmbio manualmente
   */
  async create(createDto: CreateExchangeRateDto) {
    // Buscar moedas
    const fromCurrency = await this.prisma.currency.findUnique({
      where: { code: createDto.fromCurrency.toUpperCase() },
    });

    const toCurrency = await this.prisma.currency.findUnique({
      where: { code: createDto.toCurrency.toUpperCase() },
    });

    if (!fromCurrency) {
      throw new NotFoundException(
        `Moeda ${createDto.fromCurrency} não encontrada`,
      );
    }

    if (!toCurrency) {
      throw new NotFoundException(
        `Moeda ${createDto.toCurrency} não encontrada`,
      );
    }

    if (fromCurrency.id === toCurrency.id) {
      throw new BadRequestException(
        'Moedas de origem e destino devem ser diferentes',
      );
    }

    const date = createDto.date ? new Date(createDto.date) : new Date();

    // Criar ou atualizar taxa
    return this.prisma.exchangeRate.upsert({
      where: {
        fromCurrencyId_toCurrencyId_date: {
          fromCurrencyId: fromCurrency.id,
          toCurrencyId: toCurrency.id,
          date,
        },
      },
      update: {
        rate: createDto.rate,
        source: 'MANUAL',
      },
      create: {
        fromCurrencyId: fromCurrency.id,
        toCurrencyId: toCurrency.id,
        rate: createDto.rate,
        date,
        source: 'MANUAL',
      },
      include: {
        fromCurrency: true,
        toCurrency: true,
      },
    });
  }

  /**
   * Listar taxas de câmbio
   */
  async findAll(fromCurrency?: string, toCurrency?: string) {
    const where: any = {};

    if (fromCurrency) {
      const from = await this.prisma.currency.findUnique({
        where: { code: fromCurrency.toUpperCase() },
      });
      if (from) where.fromCurrencyId = from.id;
    }

    if (toCurrency) {
      const to = await this.prisma.currency.findUnique({
        where: { code: toCurrency.toUpperCase() },
      });
      if (to) where.toCurrencyId = to.id;
    }

    return this.prisma.exchangeRate.findMany({
      where,
      include: {
        fromCurrency: true,
        toCurrency: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: 100,
    });
  }

  /**
   * Buscar taxa de câmbio mais recente
   */
  async getLatestRate(fromCurrencyCode: string, toCurrencyCode: string) {
    const fromCurrency = await this.prisma.currency.findUnique({
      where: { code: fromCurrencyCode.toUpperCase() },
    });

    const toCurrency = await this.prisma.currency.findUnique({
      where: { code: toCurrencyCode.toUpperCase() },
    });

    if (!fromCurrency || !toCurrency) {
      throw new NotFoundException('Moeda não encontrada');
    }

    // Mesma moeda = taxa 1.0
    if (fromCurrency.id === toCurrency.id) {
      return {
        fromCurrency,
        toCurrency,
        rate: 1.0,
        date: new Date(),
        source: 'SYSTEM',
      };
    }

    const rate = await this.prisma.exchangeRate.findFirst({
      where: {
        fromCurrencyId: fromCurrency.id,
        toCurrencyId: toCurrency.id,
      },
      orderBy: {
        date: 'desc',
      },
      include: {
        fromCurrency: true,
        toCurrency: true,
      },
    });

    if (!rate) {
      // Tentar buscar taxa inversa
      const inverseRate = await this.prisma.exchangeRate.findFirst({
        where: {
          fromCurrencyId: toCurrency.id,
          toCurrencyId: fromCurrency.id,
        },
        orderBy: {
          date: 'desc',
        },
      });

      if (inverseRate) {
        return {
          fromCurrency,
          toCurrency,
          rate: 1 / Number(inverseRate.rate),
          date: inverseRate.date,
          source: `${inverseRate.source} (INVERTED)`,
        };
      }

      throw new NotFoundException(
        `Taxa de câmbio não encontrada para ${fromCurrencyCode}/${toCurrencyCode}`,
      );
    }

    return rate;
  }

  /**
   * Converter valor entre moedas
   */
  async convert(convertDto: ConvertCurrencyDto) {
    const rate = await this.getLatestRate(
      convertDto.fromCurrency,
      convertDto.toCurrency,
    );

    const convertedAmount = convertDto.amount * Number(rate.rate);

    return {
      amount: convertDto.amount,
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rate: Number(rate.rate),
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      date: rate.date,
    };
  }

  /**
   * Consolidar saldos em moeda preferida
   */
  async consolidateBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const preferredCurrency = user.preferredCurrency || 'BRL';

    // Buscar todas as contas do usuário
    const accounts = await this.prisma.account.findMany({
      where: {
        userId,
        isActive: true,
      },
    });

    let totalInPreferredCurrency = 0;
    const accountBalances = [];

    for (const account of accounts) {
      const balance = Number(account.currentBalance);

      if (account.currency === preferredCurrency) {
        // Mesma moeda, sem conversão
        totalInPreferredCurrency += balance;
        accountBalances.push({
          accountId: account.id,
          accountName: account.name,
          currency: account.currency,
          balance,
          convertedBalance: balance,
          rate: 1.0,
        });
      } else {
        // Converter para moeda preferida
        try {
          const rate = await this.getLatestRate(
            account.currency,
            preferredCurrency,
          );
          const convertedBalance = balance * Number(rate.rate);
          totalInPreferredCurrency += convertedBalance;

          accountBalances.push({
            accountId: account.id,
            accountName: account.name,
            currency: account.currency,
            balance,
            convertedBalance: Math.round(convertedBalance * 100) / 100,
            rate: Number(rate.rate),
          });
        } catch (error) {
          this.logger.warn(
            `Taxa não encontrada para ${account.currency}/${preferredCurrency}`,
          );
          // Se não houver taxa, não incluir na consolidação
        }
      }
    }

    return {
      preferredCurrency,
      totalBalance: Math.round(totalInPreferredCurrency * 100) / 100,
      accounts: accountBalances,
    };
  }

  /**
   * Job automático: Atualizar taxas de câmbio (roda todo dia às 9h)
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async updateExchangeRates() {
    this.logger.log('💱 Atualizando taxas de câmbio...');

    try {
      // API gratuita: exchangerate-api.com (1500 requests/mês grátis)
      // Ou use: api.exchangerate.host (gratuita)
      const API_URL = 'https://api.exchangerate.host/latest?base=USD';

      const response = await axios.get(API_URL);
      const rates = response.data.rates;

      if (!rates) {
        this.logger.error('Erro ao buscar taxas de câmbio');
        return;
      }

      const usdCurrency = await this.prisma.currency.findUnique({
        where: { code: 'USD' },
      });

      if (!usdCurrency) {
        this.logger.warn('Moeda USD não encontrada no banco');
        return;
      }

      let updateCount = 0;

      // Atualizar taxas de USD para outras moedas
      for (const [currencyCode, rate] of Object.entries(rates)) {
        const toCurrency = await this.prisma.currency.findUnique({
          where: { code: currencyCode },
        });

        if (toCurrency && toCurrency.isActive) {
          await this.prisma.exchangeRate.create({
            data: {
              fromCurrencyId: usdCurrency.id,
              toCurrencyId: toCurrency.id,
              rate: Number(rate),
              date: new Date(),
              source: 'API',
            },
          });
          updateCount++;
        }
      }

      this.logger.log(`✅ ${updateCount} taxas de câmbio atualizadas`);
    } catch (error) {
      this.logger.error('Erro ao atualizar taxas de câmbio:', error.message);
    }
  }

  /**
   * Deletar taxa de câmbio
   */
  async remove(id: string) {
    const rate = await this.prisma.exchangeRate.findUnique({
      where: { id },
    });

    if (!rate) {
      throw new NotFoundException('Taxa de câmbio não encontrada');
    }

    await this.prisma.exchangeRate.delete({
      where: { id },
    });

    return { message: 'Taxa de câmbio deletada com sucesso' };
  }
}
