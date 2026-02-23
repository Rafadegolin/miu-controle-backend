import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
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
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateProjectItemDto } from './dto/create-project-item.dto';
import { UpdateProjectItemDto } from './dto/update-project-item.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { ConvertQuoteDto } from './dto/convert-quote.dto';
import { ProjectStatus } from '@prisma/client';

@ApiTags('Projetos (Planejamento de Despesas)')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // ═══════════════════════════════════════════════════════════════
  //  PROJECTS
  // ═══════════════════════════════════════════════════════════════

  @Post()
  @ApiOperation({
    summary: 'Criar novo projeto',
    description:
      'Cria um projeto financeiro para organizar despesas complexas em itens e comparar orçamentos.',
  })
  @ApiResponse({ status: 201, description: 'Projeto criado com sucesso' })
  create(@CurrentUser() user, @Body() dto: CreateProjectDto) {
    return this.projectsService.createProject(user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar projetos',
    description: 'Lista todos os projetos do usuário, com contagem de itens.',
  })
  @ApiQuery({
    name: 'status',
    enum: ProjectStatus,
    required: false,
    description: 'Filtrar por status',
  })
  @ApiResponse({ status: 200, description: 'Lista de projetos' })
  findAll(@CurrentUser() user, @Query('status') status?: ProjectStatus) {
    return this.projectsService.findAllProjects(user.id, status);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalhes do projeto',
    description:
      'Retorna o projeto completo com todos os itens e cotações associadas.',
  })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiResponse({ status: 200, description: 'Projeto encontrado' })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.projectsService.findOneProject(user.id, id);
  }

  @Get(':id/summary')
  @ApiOperation({
    summary: 'Dashboard do projeto',
    description:
      'Retorna estatísticas: total orçado vs gasto, economia em relação aos orçamentos descartados, progresso de itens.',
  })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiResponse({ status: 200, description: 'Resumo calculado com sucesso' })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  getSummary(@Param('id') id: string, @CurrentUser() user) {
    return this.projectsService.getProjectSummary(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar projeto' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiResponse({ status: 200, description: 'Projeto atualizado' })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  update(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remover projeto',
    description:
      'Remove o projeto e todos os itens/cotações associados (cascade). Transações geradas são preservadas.',
  })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiResponse({ status: 200, description: 'Projeto removido' })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.projectsService.removeProject(user.id, id);
  }

  // ═══════════════════════════════════════════════════════════════
  //  PROJECT ITEMS
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/items')
  @ApiOperation({
    summary: 'Adicionar item ao projeto',
    description:
      'Adiciona um item (ex: "Bateria nova") ao projeto para receber cotações.',
  })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiResponse({ status: 201, description: 'Item adicionado' })
  @ApiResponse({ status: 404, description: 'Projeto não encontrado' })
  addItem(
    @Param('id') id: string,
    @CurrentUser() user,
    @Body() dto: CreateProjectItemDto,
  ) {
    return this.projectsService.addItem(user.id, id, dto);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Atualizar item do projeto' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiParam({ name: 'itemId', description: 'ID do item' })
  @ApiResponse({ status: 200, description: 'Item atualizado' })
  @ApiResponse({ status: 404, description: 'Item não encontrado' })
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user,
    @Body() dto: UpdateProjectItemDto,
  ) {
    return this.projectsService.updateItem(user.id, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover item do projeto' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiParam({ name: 'itemId', description: 'ID do item' })
  @ApiResponse({ status: 200, description: 'Item removido' })
  @ApiResponse({ status: 404, description: 'Item não encontrado' })
  removeItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user,
  ) {
    return this.projectsService.removeItem(user.id, id, itemId);
  }

  // ═══════════════════════════════════════════════════════════════
  //  QUOTES
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/items/:itemId/quotes')
  @ApiOperation({
    summary: 'Adicionar cotação ao item',
    description:
      'Cria uma cotação de fornecedor para o item (ex: AutoPeças - R$ 450).',
  })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiParam({ name: 'itemId', description: 'ID do item' })
  @ApiResponse({ status: 201, description: 'Cotação adicionada' })
  @ApiResponse({
    status: 409,
    description: 'Item já comprado — cotações não aceitas',
  })
  addQuote(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.projectsService.addQuote(user.id, id, itemId, dto);
  }

  @Patch(':id/items/:itemId/quotes/:quoteId')
  @ApiOperation({ summary: 'Atualizar cotação' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiParam({ name: 'itemId', description: 'ID do item' })
  @ApiParam({ name: 'quoteId', description: 'ID da cotação' })
  @ApiResponse({ status: 200, description: 'Cotação atualizada' })
  @ApiResponse({
    status: 409,
    description: 'Cotação já convertida em transação',
  })
  updateQuote(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user,
    @Body() dto: UpdateQuoteDto,
  ) {
    return this.projectsService.updateQuote(user.id, id, itemId, quoteId, dto);
  }

  @Delete(':id/items/:itemId/quotes/:quoteId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover cotação' })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiParam({ name: 'itemId', description: 'ID do item' })
  @ApiParam({ name: 'quoteId', description: 'ID da cotação' })
  @ApiResponse({ status: 200, description: 'Cotação removida' })
  @ApiResponse({
    status: 409,
    description: 'Cotação já convertida em transação',
  })
  removeQuote(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user,
  ) {
    return this.projectsService.removeQuote(user.id, id, itemId, quoteId);
  }

  @Patch(':id/items/:itemId/quotes/:quoteId/select')
  @ApiOperation({
    summary: 'Selecionar cotação',
    description:
      'Marca esta cotação como SELECTED e desmarca automaticamente as demais cotações do mesmo item.',
  })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiParam({ name: 'itemId', description: 'ID do item' })
  @ApiParam({ name: 'quoteId', description: 'ID da cotação a selecionar' })
  @ApiResponse({
    status: 200,
    description: 'Cotação selecionada com sucesso',
  })
  @ApiResponse({
    status: 409,
    description: 'Cotação já convertida em transação',
  })
  selectQuote(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user,
  ) {
    return this.projectsService.selectQuote(user.id, id, itemId, quoteId);
  }

  @Patch(':id/items/:itemId/quotes/:quoteId/reject')
  @ApiOperation({
    summary: 'Rejeitar cotação',
    description: 'Marca esta cotação como REJECTED (descartada).',
  })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiParam({ name: 'itemId', description: 'ID do item' })
  @ApiParam({ name: 'quoteId', description: 'ID da cotação' })
  @ApiResponse({ status: 200, description: 'Cotação rejeitada' })
  rejectQuote(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('quoteId') quoteId: string,
    @CurrentUser() user,
  ) {
    return this.projectsService.rejectQuote(user.id, id, itemId, quoteId);
  }

  // ═══════════════════════════════════════════════════════════════
  //  CONVERT
  // ═══════════════════════════════════════════════════════════════

  @Post(':id/items/:itemId/convert')
  @ApiOperation({
    summary: 'Converter cotação selecionada em transação',
    description: `
Fluxo completo de conversão:
1. Valida que o item não foi comprado (evita duplicidade)
2. Localiza a cotação com status SELECTED
3. Cria uma Transaction EXPENSE com o valor total (preço + adicionais)
4. Debita o saldo da conta informada
5. Atualiza o item para PURCHASED e a cotação para CONVERTED
6. Recalcula o status do projeto (PLANNING → IN_PROGRESS → COMPLETED)
    `,
  })
  @ApiParam({ name: 'id', description: 'ID do projeto' })
  @ApiParam({ name: 'itemId', description: 'ID do item a comprar' })
  @ApiBody({ type: ConvertQuoteDto })
  @ApiResponse({
    status: 201,
    description: 'Transação criada e item marcado como comprado',
  })
  @ApiResponse({
    status: 409,
    description: 'Item já foi comprado anteriormente',
  })
  @ApiResponse({
    status: 422,
    description: 'Nenhuma cotação está selecionada para este item',
  })
  @ApiResponse({
    status: 404,
    description: 'Conta ou categoria não encontrada',
  })
  convertQuote(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user,
    @Body() dto: ConvertQuoteDto,
  ) {
    return this.projectsService.convertQuote(user.id, id, itemId, dto);
  }
}
