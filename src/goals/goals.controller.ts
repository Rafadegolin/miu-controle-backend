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
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { ContributeGoalDto } from './dto/contribute-goal.dto';
import { AddPurchaseLinkDto } from './dto/add-purchase-link.dto';
import { UpdatePurchaseLinkDto } from './dto/update-purchase-link.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GoalStatus } from '@prisma/client';
import { UploadService } from '../upload/upload.service';

@ApiTags('Objetivos (Potes)')
@Controller('goals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GoalsController {
  constructor(
    private readonly goalsService: GoalsService,
    private readonly uploadService: UploadService,
  ) {}

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

  @Get('hierarchy')
  @ApiOperation({ summary: 'Listar hierarquia de objetivos (Árvore)' })
  getHierarchy(@CurrentUser() user) {
      return this.goalsService.getHierarchy(user.id);
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

  // ==================== IMAGENS ====================

  @Post(':id/image')
  @ApiOperation({ summary: 'Upload de imagem da meta' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image'))
  async uploadGoalImage(
    @Param('id') goalId: string,
    @CurrentUser() user,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
  ) {
    // Validar se a meta pertence ao usuário
    const goal = await this.goalsService.findOne(goalId, user.id);

    if (!goal) {
      throw new BadRequestException('Meta não encontrada');
    }

    // Se já tem imagem, deletar a antiga
    if (goal.imageKey) {
      try {
        await this.uploadService.deleteGoalImage(goal.imageKey);
      } catch (error) {
        console.error('Erro ao deletar imagem antiga:', error);
        // Continuar mesmo se falhar a deleção da antiga
      }
    }

    // Upload da nova imagem
    const uploadResult = await this.uploadService.uploadGoalImage(
      file,
      user.id,
      goalId,
    );

    // Atualizar meta no banco
    const updatedGoal = await this.goalsService.updateImage(goalId, {
      imageUrl: uploadResult.url,
      imageKey: uploadResult.key,
      imageMimeType: uploadResult.mimeType,
      imageSize: uploadResult.size,
    });

    return {
      message: 'Imagem da meta atualizada com sucesso',
      goal: updatedGoal,
    };
  }

  @Delete(':id/image')
  @ApiOperation({ summary: 'Remover imagem da meta' })
  async deleteGoalImage(@Param('id') goalId: string, @CurrentUser() user) {
    const goal = await this.goalsService.findOne(goalId, user.id);

    if (!goal) {
      throw new BadRequestException('Meta não encontrada');
    }

    if (!goal.imageKey) {
      throw new BadRequestException('Meta não possui imagem');
    }

    // Deletar arquivo
    await this.uploadService.deleteGoalImage(goal.imageKey);

    // Atualizar meta
    const updatedGoal = await this.goalsService.updateImage(goalId, {
      imageUrl: null,
      imageKey: null,
      imageMimeType: null,
      imageSize: null,
    });

    return {
      message: 'Imagem removida com sucesso',
      goal: updatedGoal,
    };
  }

  // ==================== LINKS DE COMPRA ====================

  @Post(':id/purchase-links')
  @ApiOperation({ summary: 'Adicionar link de compra à meta' })
  async addPurchaseLink(
    @Param('id') goalId: string,
    @Body() dto: AddPurchaseLinkDto,
    @CurrentUser() user,
  ) {
    const updatedGoal = await this.goalsService.addPurchaseLink(
      goalId,
      user.id,
      dto,
    );

    return {
      message: 'Link adicionado com sucesso',
      goal: updatedGoal,
    };
  }

  @Patch(':id/purchase-links/:linkId')
  @ApiOperation({ summary: 'Atualizar link de compra' })
  async updatePurchaseLink(
    @Param('id') goalId: string,
    @Param('linkId') linkId: string,
    @Body() dto: UpdatePurchaseLinkDto,
    @CurrentUser() user,
  ) {
    const updatedGoal = await this.goalsService.updatePurchaseLink(
      goalId,
      linkId,
      user.id,
      dto,
    );

    return {
      message: 'Link atualizado com sucesso',
      goal: updatedGoal,
    };
  }

  @Delete(':id/purchase-links/:linkId')
  @ApiOperation({ summary: 'Remover link de compra' })
  async deletePurchaseLink(
    @Param('id') goalId: string,
    @Param('linkId') linkId: string,
    @CurrentUser() user,
  ) {
    const updatedGoal = await this.goalsService.deletePurchaseLink(
      goalId,
      linkId,
      user.id,
    );

    return {
      message: 'Link removido com sucesso',
      goal: updatedGoal,
    };
  }

  @Get(':id/purchase-links/summary')
  @ApiOperation({ summary: 'Resumo dos links de compra (total de preços)' })
  async getPurchaseLinksSummary(
    @Param('id') goalId: string,
    @CurrentUser() user,
  ) {
    return this.goalsService.getTotalPurchaseLinksPrice(goalId, user.id);
  }
}
