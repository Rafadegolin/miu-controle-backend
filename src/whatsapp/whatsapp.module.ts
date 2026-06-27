import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { EvolutionService } from './evolution.service';
import { TransactionsModule } from '../transactions/transactions.module';

// PrismaModule e ConfigModule são @Global; precisamos de HttpModule (axios) e
// do TransactionsModule (para reusar TransactionsService.create com IA/saldo).
@Module({
  imports: [HttpModule, TransactionsModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, EvolutionService],
})
export class WhatsappModule {}
