import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { AiModule } from '../ai/ai.module';
import { BrandsModule } from '../brands/brands.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [WebsocketModule, AiModule, BrandsModule, UploadModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
