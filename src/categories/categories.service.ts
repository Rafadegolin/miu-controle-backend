import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryType } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createCategoryDto: CreateCategoryDto) {
    // Validar se categoria pai existe (se fornecida)
    if (createCategoryDto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: createCategoryDto.parentId },
      });

      if (!parent) {
        throw new NotFoundException('Categoria pai não encontrada');
      }

      // Validar se categoria pai é do mesmo usuário ou é do sistema
      if (parent.userId && parent.userId !== userId) {
        throw new ForbiddenException(
          'Você não pode usar esta categoria como pai',
        );
      }

      // Validar se tipos são compatíveis
      if (parent.type !== createCategoryDto.type) {
        throw new BadRequestException(
          `Categoria pai é do tipo ${parent.type}, mas você está criando uma ${createCategoryDto.type}`,
        );
      }
    }

    return this.prisma.category.create({
      data: {
        userId,
        name: createCategoryDto.name,
        type: createCategoryDto.type,
        color:
          createCategoryDto.color ||
          this.getDefaultColor(createCategoryDto.type),
        icon: createCategoryDto.icon,
        parentId: createCategoryDto.parentId,
        isSystem: false,
      },
      include: {
        parent: true,
      },
    });
  }

  async findAll(userId: string, type?: CategoryType) {
    const where: any = {
      OR: [
        { userId }, // Categorias do usuário
        { userId: null, isSystem: true }, // Categorias do sistema
      ],
    };

    if (type) {
      where.type = type;
    }

    return this.prisma.category.findMany({
      where,
      include: {
        parent: true,
        children: true,
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: [
        { isSystem: 'desc' }, // Sistema primeiro
        { name: 'asc' },
      ],
    });
  }

  async findOne(id: string, userId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    // Verificar permissão (categoria do sistema OU do usuário)
    if (category.userId && category.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para acessar esta categoria',
      );
    }

    return category;
  }

  async update(
    id: string,
    userId: string,
    updateCategoryDto: UpdateCategoryDto,
  ) {
    const category = await this.findOne(id, userId);

    // Não permitir editar categorias do sistema
    if (category.isSystem) {
      throw new ForbiddenException(
        'Não é possível editar categorias do sistema',
      );
    }

    // Validar categoria pai (se mudando)
    if (updateCategoryDto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: updateCategoryDto.parentId },
      });

      if (!parent) {
        throw new NotFoundException('Categoria pai não encontrada');
      }

      // Não permitir que categoria seja pai de si mesma
      if (parent.id === id) {
        throw new BadRequestException('Categoria não pode ser pai de si mesma');
      }

      // Validar tipos
      if (parent.type !== (updateCategoryDto.type || category.type)) {
        throw new BadRequestException(
          'Tipos incompatíveis entre categoria e pai',
        );
      }
    }

    return this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
      include: {
        parent: true,
        children: true,
      },
    });
  }

  async remove(id: string, userId: string) {
    const category = await this.findOne(id, userId);

    // Não permitir deletar categorias do sistema
    if (category.isSystem) {
      throw new ForbiddenException(
        'Não é possível deletar categorias do sistema',
      );
    }

    // Verificar se tem transações usando esta categoria
    const transactionsCount = await this.prisma.transaction.count({
      where: { categoryId: id },
    });

    if (transactionsCount > 0) {
      throw new BadRequestException(
        `Não é possível deletar categoria com ${transactionsCount} transação(ões) associada(s)`,
      );
    }

    // Verificar se tem subcategorias
    const childrenCount = await this.prisma.category.count({
      where: { parentId: id },
    });

    if (childrenCount > 0) {
      throw new BadRequestException(
        `Não é possível deletar categoria com ${childrenCount} subcategoria(s)`,
      );
    }

    await this.prisma.category.delete({ where: { id } });

    return { message: 'Categoria deletada com sucesso' };
  }

  async getStats(
    userId: string,
    categoryId: string,
    startDate?: Date,
    endDate?: Date,
  ) {
    const category = await this.findOne(categoryId, userId);

    const where: any = {
      categoryId,
      status: 'COMPLETED',
    };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const [transactions, total, count] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        take: 10,
      }),
      this.prisma.transaction.aggregate({
        where,
        _sum: { amount: true },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      category,
      total: total._sum.amount || 0,
      count,
      average: count > 0 ? Number(total._sum.amount) / count : 0,
      recentTransactions: transactions,
    };
  }

  private getDefaultColor(type: CategoryType): string {
    const colors = {
      EXPENSE: '#EF4444',
      INCOME: '#10B981',
      TRANSFER: '#6366F1',
    };
    return colors[type] || '#64748B';
  }
}
