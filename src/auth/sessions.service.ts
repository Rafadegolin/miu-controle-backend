import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lista todas as sessões ativas do usuário
   */
  async getUserSessions(userId: string, currentToken: string) {
    const sessions = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() }, // Não expirados
      },
      select: {
        id: true,
        deviceInfo: true,
        ipAddress: true,
        lastUsedAt: true,
        createdAt: true,
        expiresAt: true,
        token: true,
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
    });

    // Marcar sessão atual
    return sessions.map((session) => ({
      id: session.id,
      deviceInfo: session.deviceInfo || 'Dispositivo Desconhecido',
      ipAddress: session.ipAddress || 'IP Desconhecido',
      lastUsedAt: session.lastUsedAt,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      isCurrent: session.token === currentToken,
    }));
  }

  /**
   * Revoga uma sessão específica
   */
  async revokeSession(userId: string, sessionId: string, currentToken: string) {
    const session = await this.prisma.refreshToken.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Sessão não encontrada');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para revogar esta sessão',
      );
    }

    if (session.token === currentToken) {
      throw new ForbiddenException(
        'Você não pode revogar sua sessão atual. Use logout.',
      );
    }

    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return {
      message: 'Sessão revogada com sucesso',
    };
  }

  /**
   * Revoga todas as sessões exceto a atual
   */
  async revokeAllSessions(userId: string, currentToken: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        token: { not: currentToken },
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return {
      message: `${result.count} sessão(ões) revogada(s) com sucesso`,
      count: result.count,
    };
  }

  /**
   * Conta sessões ativas
   */
  async countActiveSessions(userId: string): Promise<number> {
    return this.prisma.refreshToken.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }
}
