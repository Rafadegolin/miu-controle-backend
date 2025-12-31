import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [WebsocketModule, AiModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
