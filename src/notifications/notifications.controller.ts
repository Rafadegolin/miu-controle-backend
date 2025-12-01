import {
  Controller,
  Get,
  Post,
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
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { MarkAsReadDto } from './dto/mark-as-read.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Notificações')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificações' })
  @ApiQuery({
    name: 'unreadOnly',
    required: false,
    type: Boolean,
    description: 'Filtrar apenas não lidas',
  })
  @ApiResponse({ status: 200, description: 'Lista de notificações' })
  async findAll(
    @CurrentUser() user: any,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const unread = unreadOnly === 'true';
    return this.notificationsService.findAll(user.id, unread);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Contar notificações não lidas' })
  @ApiResponse({ status: 200, description: 'Quantidade de não lidas' })
  async countUnread(@CurrentUser() user: any) {
    const count = await this.notificationsService.countUnread(user.id);
    return { count };
  }

  @Post('mark-as-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar notificações como lidas' })
  @ApiResponse({ status: 200, description: 'Notificações marcadas como lidas' })
  async markAsRead(
    @CurrentUser() user: any,
    @Body() markAsReadDto: MarkAsReadDto,
  ) {
    return this.notificationsService.markAsRead(user.id, markAsReadDto.ids);
  }

  @Post('mark-all-as-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar todas como lidas' })
  @ApiResponse({ status: 200, description: 'Todas marcadas como lidas' })
  async markAllAsRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Delete('clear-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Limpar notificações lidas' })
  @ApiResponse({ status: 200, description: 'Notificações lidas removidas' })
  async clearRead(@CurrentUser() user: any) {
    return this.notificationsService.clearRead(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deletar notificação' })
  @ApiResponse({ status: 200, description: 'Notificação deletada' })
  @ApiResponse({ status: 404, description: 'Notificação não encontrada' })
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationsService.remove(user.id, id);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[TESTE] Criar notificação de teste' })
  async createTest(@CurrentUser() user: any) {
    return this.notificationsService.create(
      user.id,
      'SYSTEM',
      '🧪 Notificação de Teste',
      'Esta é uma notificação de teste do sistema!',
      { test: true },
    );
  }
}
