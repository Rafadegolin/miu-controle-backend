import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { Socket } from 'socket.io';

/**
 * Guard para autenticação JWT em conexões WebSocket
 * Valida o token no handshake e adiciona os dados do usuário ao socket
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      
      // Extrai token do handshake (auth ou query)
      const token = 
        client.handshake.auth?.token || 
        client.handshake.query?.token as string;

      if (!token) {
        this.logger.warn('❌ WebSocket connection rejected: No token provided');
        return false;
      }

      // Valida token JWT
      const payload = this.jwtService.verify(token);
      
      if (!payload || !payload.sub) {
        this.logger.warn('❌ WebSocket connection rejected: Invalid token payload');
        return false;
      }

      // Busca usuário no banco
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      });

      if (!user) {
        this.logger.warn(`❌ WebSocket connection rejected: User not found (${payload.sub})`);
        return false;
      }

      // Armazena dados do usuário no socket para uso posterior
      client.data.userId = user.id;
      client.data.userEmail = user.email;

      this.logger.log(`✅ WebSocket authenticated: ${user.email} (${user.id})`);
      return true;

    } catch (error) {
      this.logger.error(`❌ WebSocket auth error: ${error.message}`);
      return false;
    }
  }
}
