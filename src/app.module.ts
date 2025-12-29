import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { ExportModule } from './export/export.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RecurringTransactionsModule } from './recurring-transactions/recurring-transactions.module';
import { CurrenciesModule } from './currencies/currencies.module';
import { ExchangeRatesModule } from './exchange-rates/exchange-rates.module';
import { ReportsModule } from './reports/reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './admin/admin.module';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';

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
    ExportModule,
    NotificationsModule,
    RecurringTransactionsModule,
    CurrenciesModule,
    ExchangeRatesModule,
    ReportsModule,
    DashboardModule,
    HealthModule,
    AdminModule,
    // 🚦 Rate Limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,    // 1 segundo
        limit: 10,    // 10 requisições por segundo
      },
      {
        name: 'medium',
        ttl: 60000,   // 1 minuto
        limit: 100,   // 100 requisições por minuto
      },
      {
        name: 'long',
        ttl: 900000,  // 15 minutos
        limit: 500,   // 500 requisições por 15 min
      },
    ]),
  ],
  providers: [
    // 🚦 ThrottlerGuard global
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // 📊 MetricsInterceptor global
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
