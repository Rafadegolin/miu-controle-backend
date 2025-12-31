import { Controller, Get, UseGuards } from '@nestjs/common';
import { WebsocketService } from './websocket.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

/**
 * Controller para endpoints de status e monitoramento do WebSocket
 */
@ApiTags('WebSocket')
@Controller('websocket')
export class WebsocketController {
  constructor(private websocketService: WebsocketService) {}

  /**
   * Retorna o status atual do WebSocket
   * Útil para debugging e monitoramento
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: 'Get WebSocket status',
    description: 'Returns current WebSocket connection statistics and connected users'
  })
  async getStatus() {
    const connectedUsers = await this.websocketService.getConnectedUsers();
    const totalConnections = this.websocketService.getConnectionCount();

    return {
      totalConnections,
      connectedUsers,
      timestamp: new Date().toISOString(),
    };
  }
}
