import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService], // Para usar em outros módulos
})
export class AccountsModule {}
