import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private prisma: PrismaService,
    private gamificationService: GamificationService,
  ) {}

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        hasCompletedOnboarding: true,
        onboardingStep: true,
        fullName: true,
        avatarUrl: true
      },
    });
    return user;
  }

  async updateStep(userId: string, step: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { onboardingStep: step },
    });
  }

  async completeOnboarding(userId: string, dto: CompleteOnboardingDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuário não encontrado');

    if (user.hasCompletedOnboarding) {
        return { message: 'Onboarding já concluído anteriormente.' };
    }

    // 1. Atualizar Preferências do Usuário
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        hasCompletedOnboarding: true,
        onboardingStep: 6, // Final step
        theme: dto.theme || 'system',
        language: dto.language || 'pt-BR',
        preferredCurrency: dto.preferredCurrency || 'BRL',
      },
    });

    // 2. Configurar IA (Upsert)
    if (dto.isAiEnabled !== undefined || dto.aiPersonality) {
      await this.prisma.userAiConfig.upsert({
        where: { userId },
        create: {
          userId,
          isAiEnabled: dto.isAiEnabled ?? true,
          personality: dto.aiPersonality || 'educator',
          usesCorporateKey: true // Default for new users? Or logic elsewhere
        },
        update: {
          isAiEnabled: dto.isAiEnabled ?? true,
          personality: dto.aiPersonality || 'educator'
        }
      });
    }

    // 3. Criar Objetivo Inicial (Exemplo: Reserva de Emergência Simples)
    // Se o frontend mandar algum sinal ou se criarmos por padrão na "personalidade investor/conservative"
    // Vamos criar um Goal genérico para eles sentirem o sistema.
    const hasGoals = await this.prisma.goal.count({ where: { userId } });
    if (hasGoals === 0) {
        await this.prisma.goal.create({
            data: {
                userId,
                name: 'Minha Primeira Meta',
                description: 'Objetivo criado durante o onboarding',
                targetAmount: 1000,
                currentAmount: 0,
                targetDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 ano
                color: '#10B981',
                icon: '🎯',
                status: 'ACTIVE'
            }
        });
    }

    // 4. Gamification: Award XP and Badge
    try {
        await this.gamificationService.awardXp(userId, 200, 'ONBOARDING_COMPLETE');
        // TODO: Create badge logic if Badge system is fully ready with codes
        // await this.gamificationService.awardBadge(userId, 'FIRST_STEPS');
    } catch (e) {
        this.logger.error('Failed to award onboarding XP', e);
    }

    return { success: true, message: 'Onboarding concluído com sucesso!' };
  }
}
