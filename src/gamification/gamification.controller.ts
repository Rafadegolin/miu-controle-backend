import { Controller, Get, Post, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { MissionsService } from './missions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CreateMissionDto } from './dto/create-mission.dto';

@ApiTags('Gamification')
@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly missionsService: MissionsService,
  ) {}

  @Get('/profile')
  @ApiOperation({ summary: 'Get gamification profile (XP, Level, Streak)' })
  async getProfile(@Request() req) {
    return this.gamificationService.getProfile(req.user.id);
  }

  @Get('/missions')
  @ApiOperation({ summary: 'Get active missions' })
  async getMissions(@Request() req) {
    return this.missionsService.getActiveMissions(req.user.id);
  }

  // --- ADMIN ROUTES ---

  @Post('admin/missions')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Criar nova template de missão (Admin)' })
  createMission(@Body() dto: CreateMissionDto) {
      return this.missionsService.create(dto);
  }

  @Get('admin/missions/templates')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar templates de missões (Admin)' })
  listTemplates() {
      return this.missionsService.findAllTemplates();
  }
}
