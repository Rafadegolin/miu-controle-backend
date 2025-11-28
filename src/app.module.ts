import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // .env disponível em todo lugar
    }),
    PrismaModule,
    AuthModule,
    AccountsModule,
    TransactionsModule,
    CategoriesModule,
  ],
})
export class AppModule {}
