import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * Serviço para abstração de emissão de eventos WebSocket
 * Permite que outros serviços emitam eventos sem conhecer detalhes do Socket.IO
 */
@Injectable()
export class WebsocketService {
  private server: Server;
  private readonly logger = new Logger(WebsocketService.name);

  /**
   * Injeta a instância do Socket.IO server
   * Chamado pelo Gateway após inicialização
   */
  setServer(server: Server) {
    this.server = server;
    this.logger.log('✅ WebSocket Server registered in WebsocketService');
  }

  /**
   * Emite evento para um usuário específico (usando room user:${userId})
   * @param userId - ID do usuário que deve receber o evento
   * @param event - Nome do evento (ex: 'transaction.created')
   * @param data - Payload do evento
   */
  emitToUser(userId: string, event: string, data: any) {
    if (!this.server) {
      this.logger.warn(
        '⚠️ WebSocket server not initialized, cannot emit event',
      );
      return;
    }

    const room = `user:${userId}`;
    this.server.to(room).emit(event, data);

    this.logger.debug(`📡 Event emitted: ${event} to ${room}`);
  }

  /**
   * Emite evento para todos os clientes conectados (broadcast)
   * @param event - Nome do evento
   * @param data - Payload do evento
   */
  emitToAll(event: string, data: any) {
    if (!this.server) {
      this.logger.warn(
        '⚠️ WebSocket server not initialized, cannot emit event',
      );
      return;
    }

    this.server.emit(event, data);
    this.logger.debug(`📡 Broadcast event emitted: ${event}`);
  }

  /**
   * Retorna a lista de usuários conectados
   */
  async getConnectedUsers(): Promise<string[]> {
    if (!this.server) {
      return [];
    }

    const rooms = await this.server.sockets.adapter.rooms;
    const users: string[] = [];

    rooms.forEach((_, roomName) => {
      if (roomName.startsWith('user:')) {
        users.push(roomName.replace('user:', ''));
      }
    });

    return users;
  }

  /**
   * Retorna o número total de conexões ativas
   */
  getConnectionCount(): number {
    if (!this.server) {
      return 0;
    }

    return this.server.sockets.sockets.size;
  }
}
