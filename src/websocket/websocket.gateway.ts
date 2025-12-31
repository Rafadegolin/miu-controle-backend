import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { WebsocketService } from './websocket.service';

/**
 * Gateway principal do WebSocket
 * Gerencia conexões, autenticação e lifecycle de sockets
 */
@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:3000',
        'https://miucontrole.com.br',
        'https://www.miucontrole.com.br',
      ];
      
      // Permite qualquer URL do Vercel (preview e production)
      const vercelPattern = /^https:\/\/.*\.vercel\.app$/;
      
      if (!origin || allowedOrigins.includes(origin) || vercelPattern.test(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 WebSocket CORS blocked: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000, // 60 segundos
  pingInterval: 30000, // 30 segundos (heartbeat)
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(private websocketService: WebsocketService) {}

  /**
   * Chamado após o gateway ser inicializado
   */
  afterInit(server: Server) {
    this.websocketService.setServer(server);
    this.logger.log('🚀 WebSocket Gateway initialized');
  }

  /**
   * Chamado quando um cliente se conecta
   * Aplica autenticação JWT e adiciona o usuário à room específica
   */
  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      // Extrair token do handshake
      const token = 
        client.handshake.auth?.token || 
        client.handshake.query?.token as string;

      if (!token) {
        this.logger.warn(`❌ Connection rejected: No token provided (${client.id})`);
        client.disconnect();
        return;
      }

      // Validar token JWT manualmente
      const { JwtService } = require('@nestjs/jwt');
      const { PrismaService } = require('../prisma/prisma.service');
      
      const jwtService = new JwtService({
        secret: process.env.JWT_SECRET || 'default-secret',
      });
      
      const prisma = new PrismaService();

      try {
        const payload = jwtService.verify(token);
        
        if (!payload || !payload.sub) {
          this.logger.warn(`❌ Connection rejected: Invalid token payload (${client.id})`);
          client.disconnect();
          return;
        }

        // Buscar usuário
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        });

        if (!user) {
          this.logger.warn(`❌ Connection rejected: User not found (${payload.sub})`);
          client.disconnect();
          return;
        }

        // Armazenar dados do usuário no socket
        client.data.userId = user.id;
        client.data.userEmail = user.email;

        const userId = user.id;
        const userEmail = user.email;

        // Adiciona o cliente à room do usuário
        const room = `user:${userId}`;
        await client.join(room);

        this.logger.log(
          `🟢 Client connected: ${userEmail} (${client.id}) → joined room: ${room}`,
        );

        // Emite evento de conexão bem-sucedida
        client.emit('connected', {
          message: 'WebSocket connected successfully',
          userId,
          timestamp: new Date().toISOString(),
        });

      } catch (jwtError) {
        this.logger.warn(`❌ Connection rejected: JWT verification failed - ${jwtError.message} (${client.id})`);
        client.disconnect();
        return;
      }

    } catch (error) {
      this.logger.error(`❌ Error handling connection: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Chamado quando um cliente se desconecta
   */
  handleDisconnect(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    const userEmail = client.data.userEmail;

    if (userId) {
      this.logger.log(
        `🔴 Client disconnected: ${userEmail} (${client.id})`,
      );
    } else {
      this.logger.log(`🔴 Client disconnected: ${client.id} (unauthenticated)`);
    }
  }
}
