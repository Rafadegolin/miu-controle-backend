import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { TransactionsModule } from './transactions/transactions.module';
import { CategoriesModule } from './categories/categories.module';
import { BudgetsModule } from './budgets/budgets.module';
import { GoalsModule } from './goals/goals.module';
import { UsersModule } from './users/users.module';
import { UploadModule } from './upload/upload.module';
import { EmailModule } from './email/email.module';

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
    BudgetsModule,
    GoalsModule,
    UsersModule,
    UploadModule,
    EmailModule,
  ],
})
export class AppModule {}
