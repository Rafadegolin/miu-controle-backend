import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@Injectable()
export class CurrenciesService {
  constructor(private prisma: PrismaService) {}

  async create(createCurrencyDto: CreateCurrencyDto) {
    // Verificar se já existe
    const existing = await this.prisma.currency.findUnique({
      where: { code: createCurrencyDto.code.toUpperCase() },
    });

    if (existing) {
      throw new ConflictException('Moeda já existe');
    }

    return this.prisma.currency.create({
      data: {
        code: createCurrencyDto.code.toUpperCase(),
        name: createCurrencyDto.name,
        symbol: createCurrencyDto.symbol,
        isActive: true,
      },
    });
  }

  async findAll(activeOnly: boolean = true) {
    return this.prisma.currency.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: {
        code: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const currency = await this.prisma.currency.findUnique({
      where: { id },
    });

    if (!currency) {
      throw new NotFoundException('Moeda não encontrada');
    }

    return currency;
  }

  async findByCode(code: string) {
    const currency = await this.prisma.currency.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!currency) {
      throw new NotFoundException(`Moeda ${code} não encontrada`);
    }

    return currency;
  }

  async update(id: string, updateCurrencyDto: UpdateCurrencyDto) {
    await this.findOne(id);

    return this.prisma.currency.update({
      where: { id },
      data: {
        ...(updateCurrencyDto.name && { name: updateCurrencyDto.name }),
        ...(updateCurrencyDto.symbol && { symbol: updateCurrencyDto.symbol }),
      },
    });
  }

  async toggleActive(id: string) {
    const currency = await this.findOne(id);

    return this.prisma.currency.update({
      where: { id },
      data: {
        isActive: !currency.isActive,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Verificar se há contas usando essa moeda
    const accountsCount = await this.prisma.account.count({
      where: { currency: id },
    });

    if (accountsCount > 0) {
      throw new ConflictException(
        `Não é possível deletar. Existem ${accountsCount} conta(s) usando esta moeda.`,
      );
    }

    await this.prisma.currency.delete({
      where: { id },
    });

    return { message: 'Moeda deletada com sucesso' };
  }
}
