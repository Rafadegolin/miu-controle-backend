import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
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
import { CacheHelperModule } from './common/cache.module';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { WebsocketModule } from './websocket/websocket.module';
import { CommonModule } from './common/common.module';
import { AiModule } from './ai/ai.module';
import { PredictionsModule } from './predictions/predictions.module';
import { ProjectionsModule } from './projections/projections.module';
import { AnalysisModule } from './analysis/analysis.module';
import { PlanningModule } from './planning/planning.module';
import { EmergencyFundModule } from './emergency-fund/emergency-fund.module';
import { ScenariosModule } from './scenarios/scenarios.module';
import { AffordabilityModule } from './affordability/affordability.module';
import { InflationSimulatorModule } from './inflation-simulator/inflation-simulator.module';
import { ProactiveAlertsModule } from './proactive-alerts/proactive-alerts.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { HealthScoreModule } from './health-score/health-score.module';
import { GamificationModule } from './gamification/gamification.module';
import { BrandsModule } from './brands/brands.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { BetterAuthMiddleware } from './auth/better-auth.middleware';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // .env disponível em todo lugar
    }),

    // Cache Module Global com Redis
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);
        const password = configService.get('REDIS_PASSWORD');
        const ttl = configService.get<number>('REDIS_TTL', 300) * 1000;

        const redisUrl = password
          ? `redis://:${password}@${host}:${port}`
          : `redis://${host}:${port}`;

        const store = new KeyvRedis(redisUrl);

        // Loga erros de conexão sem derrubar a aplicação
        store.on('error', (err: Error) =>
          console.error('❌ Redis cache error:', err.message),
        );

        console.log('✅ Redis cache initialized');
        return { stores: [store], ttl };
      },
    }),

    // Import CacheHelperModule for CacheService
    CacheHelperModule,

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
    AuditModule,
    WebsocketModule,
    CommonModule, // Global services (EncryptionService)
    AiModule, // AI services (Categorization, Usage tracking)
    PredictionsModule, // Variable Expense Predictions (Issue #47)
    ProjectionsModule, // Cash Flow Projections (Issue #43)
    AnalysisModule, // Monthly Analysis (Issue #52)
    // 🚦 Rate Limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 segundo
        limit: 10, // 10 requisições por segundo
      },
      {
        name: 'medium',
        ttl: 60000, // 1 minuto
        limit: 100, // 100 requisições por minuto
      },
      {
        name: 'long',
        ttl: 900000, // 15 minutos
        limit: 500, // 500 requisições por 15 min
      },
    ]),
    PlanningModule,
    EmergencyFundModule,
    ScenariosModule,
    AffordabilityModule,
    InflationSimulatorModule,
    ProactiveAlertsModule,
    RecommendationsModule,
    HealthScoreModule,
    GamificationModule,
    BrandsModule,
    OnboardingModule,
    ProjectsModule, // Planejamento de Despesas com Orçamentos (Issue #79)
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
    // 📝 AuditInterceptor global
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // O Better Auth intercepta todas as rotas /api/auth/* para gerenciar
    // o fluxo OAuth do Google (signin, callback, get-session, sign-out).
    // O path *path é necessário no NestJS v10+ para wildcard no forRoutes.
    consumer.apply(BetterAuthMiddleware).forRoutes('/api/auth/*path');
  }
}
