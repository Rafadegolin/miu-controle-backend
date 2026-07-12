import { Module } from '@nestjs/common';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { WebsocketModule } from '../websocket/websocket.module';

// PrismaModule e CacheHelperModule são @Global; só precisamos do WebsocketModule.
@Module({
  imports: [WebsocketModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
