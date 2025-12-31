import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WebsocketGateway } from './websocket.gateway';
import { WebsocketService } from './websocket.service';
import { WebsocketController } from './websocket.controller';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Módulo WebSocket
 * Exporta WebsocketService para uso em outros módulos
 */
@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [WebsocketGateway, WebsocketService, WsJwtGuard],
  controllers: [WebsocketController],
  exports: [WebsocketService], // Exporta para uso em outros módulos
})
export class WebsocketModule {}
