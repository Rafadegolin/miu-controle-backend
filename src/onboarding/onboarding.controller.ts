import { Controller, Get, Post, Body, UseGuards, Request, Patch } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { UpdateOnboardingStepDto } from './dto/update-onboarding-step.dto';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  @ApiOperation({ summary: 'Obter status do onboarding do usuário' })
  getStatus(@Request() req) {
    // Assuming AuthGuard puts user in req.user
    // If AuthGuard is global or used here (add UseGuards if needed explicitly)
    return this.onboardingService.getStatus(req.user.id);
  }

  @Post('step')
  @ApiOperation({ summary: 'Atualizar passo atual do onboarding' })
  updateStep(@Request() req, @Body() dto: UpdateOnboardingStepDto) {
    return this.onboardingService.updateStep(req.user.id, dto.step);
  }

  @Post('complete')
  @ApiOperation({ summary: 'Finalizar onboarding e salvar preferências' })
  complete(@Request() req, @Body() dto: CompleteOnboardingDto) {
    return this.onboardingService.completeOnboarding(req.user.id, dto);
  }
}
