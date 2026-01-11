import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ReleaseNotesService } from './release-notes.service';
import { CreateReleaseNoteDto } from './dto/create-release-note.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Release Notes')
@Controller('release-notes') // Removed 'admin' prefix to allow user access to some routes easier, or stick to mixed controller
export class ReleaseNotesController {
  constructor(private readonly releaseNotesService: ReleaseNotesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar nota de atualização (Admin)' })
  create(@Body() dto: CreateReleaseNoteDto) {
    return this.releaseNotesService.create(dto);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todas as notas (Admin)' })
  findAll() {
    return this.releaseNotesService.findAll();
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter notas não lidas pelo usuário atual' })
  getPending(@Req() req) {
    return this.releaseNotesService.getPendingForUser(req.user.id);
  }

  @Post(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar nota como lida' })
  markAsRead(@Param('id') id: string, @Req() req) {
    return this.releaseNotesService.markAsRead(req.user.id, id);
  }
}
