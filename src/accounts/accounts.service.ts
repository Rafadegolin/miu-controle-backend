import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createAccountDto: CreateAccountDto) {
    return this.prisma.account.create({
      data: {
        userId,
        name: createAccountDto.name,
        type: createAccountDto.type,
        bankCode: createAccountDto.bankCode,
        initialBalance: createAccountDto.initialBalance || 0,
        currentBalance: createAccountDto.initialBalance || 0,
        color: createAccountDto.color || '#6366F1',
        icon: createAccountDto.icon,
      },
    });
  }

  async findAll(userId: string, activeOnly = true) {
    return this.prisma.account.findMany({
      where: {
        userId,
        ...(activeOnly && { isActive: true }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, userId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException('Conta não encontrada');
    }

    if (account.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar esta conta',
      );
    }

    return account;
  }

  async update(id: string, userId: string, updateAccountDto: UpdateAccountDto) {
    // Verificar se a conta existe e pertence ao usuário
    await this.findOne(id, userId);

    return this.prisma.account.update({
      where: { id },
      data: updateAccountDto,
    });
  }

  async remove(id: string, userId: string) {
    // Verificar se a conta existe e pertence ao usuário
    await this.findOne(id, userId);

    // Soft delete (desativar ao invés de deletar)
    return this.prisma.account.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getBalance(userId: string) {
    const accounts = await this.findAll(userId, true);

    const totalBalance = accounts.reduce(
      (sum, account) => sum + Number(account.currentBalance),
      0,
    );

    return {
      totalBalance,
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        balance: Number(account.currentBalance),
        color: account.color,
        icon: account.icon,
      })),
    };
  }
}
