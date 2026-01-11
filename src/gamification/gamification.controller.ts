import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { MissionsService } from './missions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

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
}
