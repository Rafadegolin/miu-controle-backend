# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

**Comunique-se sempre em português (pt-BR) neste projeto** — todas as respostas, explicações e mensagens ao usuário. O código também é **português-first**: comentários, mensagens de commit, descrições do Swagger, logs (com emoji) e mensagens de exceção voltadas ao usuário ficam em português. Mantenha esse padrão ao escrever código novo.

## Project

**Miu Controle** — REST API for a personal finance app (NestJS 11 + Prisma 5 + PostgreSQL + Redis).

## Commands

```bash
npm run start:dev          # Dev server with watch (port 3001 by default)
npm run build              # nest build → outputs to dist/src/ (sourceRoot is src)
npm run lint               # eslint --fix over src/apps/libs/test
npm run format             # prettier --write

npm test                   # Jest unit tests (*.spec.ts, colocated + test/unit/)
npm test -- transactions   # Run a single test file by name pattern
npm run test:watch
npm run test:cov           # Coverage
npm run test:e2e           # E2E tests (test/*.e2e-spec.ts, uses test/jest-e2e.json)

npm run prisma:generate    # Regenerate Prisma client (run after schema changes)
npm run prisma:migrate     # Create + apply a dev migration
npm run prisma:studio      # Prisma Studio GUI
npm run prisma:seed        # Seed DB (prisma/seed.ts) — 19 default categories, etc.
```

- The `Makefile` has `make up/down/logs/migrate/seed` Docker helpers, but **there is no `docker-compose.yml` in the repo** — those targets require an external compose file. The `Dockerfile` itself is a standalone multi-stage build.
- E2E tests need a **separate test database** — they load `.env.test` (`miu_controle_test`). Never point them at the dev/prod DB.
- Production entrypoint (`docker-entrypoint.sh`) waits for Postgres, runs `prisma migrate deploy`, then `node dist/src/main.js`. Note: migrations are **skipped when `RUN_SEED=false`** (that one env var gates both seed and migrations).

## Architecture

Standard NestJS **module-per-feature** layout. Each feature dir (`src/transactions`, `src/budgets`, `src/goals`, …) contains `*.module.ts`, `*.controller.ts`, `*.service.ts`, a `dto/` folder, and sometimes `entities/`. ~40 feature modules are wired in `src/app.module.ts` — that file is the map of the system.

### Global pipeline (configured in `main.ts` + `app.module.ts`)
- **ValidationPipe** with `whitelist: true, forbidNonWhitelisted: true, transform: true` — every endpoint body/query must be a `class-validator` DTO or unknown fields are rejected.
- Global guards/interceptors: `ThrottlerGuard` (rate limiting — short/medium/long tiers; override per-route with `@Throttle(...)`), `MetricsInterceptor`, `AuditInterceptor` (auto-logs mutations to `AuditLog`).
- Also global: `helmet`, CORS allow-list (localhost, `*.vercel.app`, `miucontrole.com.br`), `TimeoutInterceptor`, `ResponseTimeInterceptor`, `ThrottlerExceptionFilter`.
- Swagger UI at `/api/docs`.

### Authentication — two coexisting systems
1. **Native email/password** → JWT. `AuthService` issues access + refresh tokens; `passport-jwt` strategy (`src/auth/strategies/jwt.strategy.ts`) loads the user on each request. Protect routes with `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()`, read the user via the `@CurrentUser()` param decorator (returns the validated user; `@CurrentUser('id')` returns a field). Role checks via `@Roles(...)` + `RolesGuard` (`SUPER_ADMIN` bypasses all checks).
2. **Better Auth** handles **only** Google/Apple social OAuth, mounted as middleware on `/api/auth/*` (see `BetterAuthMiddleware` in `app.module.ts`). It is **ESM-only**, so `better-auth.config.ts` loads it via a dynamic-`import()` trick (`esmImport`) to avoid `ERR_REQUIRE_ESM`, and uses its **own `PrismaClient` instance** (needed before Nest bootstraps). It shares the `User` model and writes to `SocialAccount` / `BetterAuthSession` / `BetterAuthVerification`.

### Service-layer conventions (cross-cutting — follow these on any mutation)
Services typically inject `PrismaService` + `CacheService` + `WebsocketService` + relevant domain/AI services. A write operation (see `TransactionsService.create`) usually:
1. Validates ownership (entity `userId === user.id`) — throws `NotFound`/`Forbidden`.
2. Updates derived state (e.g. account balance) in the same flow.
3. **Invalidates cache** via `CacheService.invalidateUserCache/invalidateAccountCache/...` (Redis, pattern-based).
4. **Emits a WebSocket event** using the `WS_EVENTS` constants (`src/websocket/events/`) for real-time client updates.
5. **Emits a domain event** (`@nestjs/event-emitter`, e.g. `TransactionCreatedEvent` in `src/common/events/`) consumed by the **gamification listener** (`src/gamification/listeners/`) to drive missions, achievements, and health-score — gamification is decoupled this way, not called directly.

### Data layer
- `PrismaService` (`src/prisma/`) is global, extends `PrismaClient`, and registers a `$use` middleware that logs any query >200ms as a slow query (kept in an in-memory ring buffer for the health/metrics endpoints).
- Schema (`prisma/schema.prisma`, ~50 models) is the financial domain core: `User`, `Account`, `Transaction`, `Category`, `Budget`, `Goal`, plus AI (`UserAiConfig`, `AiUsageMetric`, `PredictionHistory`, `AnomalyDetection`), gamification (`Mission`, `Achievement`, `HealthScore`), and projects/quotes. Migrations are append-only in `prisma/migrations/`.

### AI subsystem (`src/ai/`)
- Pluggable providers: `GeminiService` and `OpenAiService`. `AiKeyManagerService` resolves which key to use — **per-user keys are encrypted at rest** via `EncryptionService` (`ENCRYPTION_KEY`, 64-hex), falling back to corporate keys (`CORPORATE_*_KEY` env).
- `AiUsageService` tracks token usage against free/paid tier limits (`FREE_TIER_TOKEN_LIMIT` / `PAID_TIER_TOKEN_LIMIT`).
- Features: auto-categorization of transactions, predictive analytics, receipt OCR, and a scheduled `AnomalyDetectionJob`.

### Other infra
- **Cache**: Redis via `@keyv/redis` + `cache-manager`, registered globally (`CacheModule`), default TTL 300s. Use `CacheService` for invalidation.
- **Storage**: MinIO/S3 (`minio` client) for avatars/uploads (`MINIO_*` env, `src/upload/`).
- **Email**: Resend (`RESEND_API_KEY`).
- **Scheduling**: `@nestjs/schedule` for cron jobs (anomaly detection, recurring transactions).

## Gotchas
- TypeScript is **loose**: `strictNullChecks: false`, `noImplicitAny: false`. Don't assume strict-null guarantees.
- Path alias: imports use `src/...` (mapped in Jest config and `tsconfig` `baseUrl: "./"`). Both relative and `src/`-prefixed imports appear in the codebase.
- After editing `prisma/schema.prisma`, run `npm run prisma:generate` (and a migration) before the new types are usable.
- `start:prod` script says `node dist/main` but the actual compiled entry is `dist/src/main.js` (used by the Docker entrypoint) — prefer the latter path.
