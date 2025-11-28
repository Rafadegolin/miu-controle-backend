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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CategoryType } from '@prisma/client';

@ApiTags('Categorias')
@Controller('categories')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar categoria personalizada' })
  create(@CurrentUser() user, @Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(user.id, createCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as categorias (sistema + usuário)' })
  @ApiQuery({ name: 'type', enum: CategoryType, required: false })
  findAll(@CurrentUser() user, @Query('type') type?: CategoryType) {
    return this.categoriesService.findAll(user.id, type);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Estatísticas de uso da categoria' })
  @ApiQuery({ name: 'startDate', required: false, example: '2025-11-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2025-11-30' })
  getStats(
    @CurrentUser() user,
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.categoriesService.getStats(
      user.id,
      id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar categoria por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.categoriesService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar categoria personalizada' })
  update(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, user.id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deletar categoria personalizada' })
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.categoriesService.remove(id, user.id);
  }
}
