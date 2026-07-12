# Miu Controle — API Handoff (Frontend)

Referência completa da API REST do Miu Controle para a refatoração do frontend.
Esta pasta documenta **toda** a API: convenções globais (este arquivo) + um documento
por domínio (ver [Índice](#índice-por-domínio)).

> **Fonte da verdade:** os _request bodies_ (DTOs) são extraídos dos DTOs com
> `class-validator`. Os _response shapes_ vêm dos services/DTOs; quando o retorno é
> um objeto Prisma cru sem DTO formal, o shape é descrito como observado no código e
> marcado com _“inferido — validar”_ quando não pôde ser confirmado campo a campo.
> Para um contrato máquina-legível, gere o `openapi.json` (ver
> [Export OpenAPI](#export-openapi)).

---

## Base URL e versionamento

- Prefixo global: **`/api`**
- Versionamento por URI: **`/api/v1/...`** (`enableVersioning` URI, `defaultVersion: '1'`)
- **Exceção:** o login social (Better Auth) vive em **`/api/auth/*`** (sem `v1`) — ver [Autenticação](#autenticação).

Exemplos: `POST /api/v1/transactions`, `GET /api/v1/dashboard/home`.

Ambiente local: `http://localhost:3001` (porta `PORT`, default 3001).
Swagger interativo: **`/api/docs`**.

---

## Autenticação

Dois mecanismos coexistem:

### 1. Email/senha → JWT (nativo)
- `POST /api/v1/auth/register` e `POST /api/v1/auth/login` retornam **`accessToken`** + **`refreshToken`** (+ objeto `user`).
- Envie o access token em todas as rotas protegidas: header **`Authorization: Bearer <accessToken>`**.
- Access token expira em ~15min (`JWT_EXPIRES_IN`). Renove com `POST /api/v1/auth/refresh` (body `{ refreshToken }`) → novos tokens.
- Sessões/dispositivos: `GET /api/v1/auth/sessions`, `DELETE /api/v1/auth/sessions/:id`, `DELETE /api/v1/auth/sessions/revoke-all`.

### 2. Login social (Google / Apple) via Better Auth
Fluxo OAuth (rotas **não versionadas**, sob `/api/auth/*`, geridas por middleware):
1. Frontend redireciona para `GET /api/auth/signin/google` (ou `/signin/apple`).
2. Após consentimento, o Better Auth cria uma sessão e retorna um `sessionToken`.
3. Frontend troca a sessão por tokens nativos: `POST /api/v1/auth/google/exchange` (ou `/apple/exchange`) com `{ sessionToken }` → retorna **o mesmo formato do login** (`user` + `accessToken` + `refreshToken`).
4. A partir daí, usa-se o JWT nativo normalmente.

Detalhes de cada endpoint em [`auth.md`](./auth.md).

---

## Formato de erros

Erros seguem o padrão do NestJS (sem envelope custom):

```jsonc
// 400 (validação) — message é um ARRAY
{ "statusCode": 400, "message": ["amount must not be less than 0.01"], "error": "Bad Request" }

// 401 / 403 / 404 — message string
{ "statusCode": 404, "message": "Conta não encontrada", "error": "Not Found" }

// 429 (rate limit) — filtro custom, + header Retry-After
{ "statusCode": 429, "message": "Limite de requisições excedido. Tente novamente mais tarde.", "error": "Too Many Requests", "retryAfter": "60s" }

// 408 — timeout global de requisição (30s, REQUEST_TIMEOUT_MS)
{ "statusCode": 408, "message": "Request timeout", "error": "Request Timeout" }
```

Validação é **global e estrita** (`whitelist: true` + `forbidNonWhitelisted: true` + `transform: true`):
campos não declarados no DTO → **400**.

---

## Convenções de resposta

- **Sem envelope**: o corpo é o objeto/array diretamente (não há `{ data, success }`).
- Header **`X-Response-Time: <ms>`** em todas as respostas.
- Valores monetários (`amount`, `targetAmount`, etc.) são `Decimal` no Prisma e chegam como **número** no JSON.
- Datas em **ISO 8601**.

### Paginação cursor-based
Listas grandes (ex.: `transactions`, `notifications`, `audit`) usam cursor:

**Query (`CursorPaginationDto`):** `cursor?: string` (id do último item) · `take?: number` (1–100, default 50).

**Resposta:**
```jsonc
{ "items": [ /* ... */ ], "nextCursor": "uuid-ou-null", "hasMore": true }
```
Para a próxima página, reenvie `cursor = nextCursor`. `hasMore: false` ou `nextCursor: null` = fim.

---

## Rate limiting

Tiers globais (`@nestjs/throttler`), aplicados a todas as rotas salvo `@SkipThrottle()`:

| Tier | Janela | Limite |
|------|--------|--------|
| short | 1s | 10 req |
| medium | 60s | 100 req |
| long | 15min | 500 req |

Overrides por endpoint (`@Throttle`):

| Endpoint | Limite |
|----------|--------|
| `POST /auth/register` · `/auth/forgot-password` · `/auth/resend-verification` | 3 / hora |
| `POST /auth/login` | 5 / min |
| `POST /auth/google/exchange` · `/auth/apple/exchange` | 10 / min |
| `POST /transactions` · `/transactions/from-receipt/confirm` | 60 / min |
| `POST /transactions/from-receipt` (OCR) | 10 / min |
| `POST /import/preview` · `/import/confirm` | 20 / min |
| `GET /export/csv` · `/export/excel` · `/export/pdf` | 10 / hora |
| `GET /health*` | sem limite (`@SkipThrottle`) |

---

## WebSocket (tempo real)

- Servidor **Socket.IO** (mesma origem/porta da API).
- Autenticação no handshake: `io(url, { auth: { token: '<accessToken JWT>' } })`. Sem token válido → conexão recusada.
- Cada usuário entra na sala `user:<userId>`; eventos são emitidos apenas para o dono.
- Eventos emitidos pelo servidor (`WS_EVENTS`):

| Evento | Quando |
|--------|--------|
| `transaction.created` / `transaction.updated` / `transaction.deleted` | CRUD de transações |
| `balance.updated` | saldo de uma conta muda (inclui import em lote) |
| `notification.new` | nova notificação in-app |
| `budget.alert` | orçamento atingiu o limite de alerta |
| `goal.milestone` | meta atingiu um marco |

Status de conexões (debug): `GET /api/v1/websocket/status`.

---

## Vias de lançamento de transação

O `source` da transação indica a origem:

| `source` | Via | Endpoint(s) |
|----------|-----|-------------|
| `MANUAL` | Manual | `POST /transactions` |
| `OCR` | Foto de comprovante | `POST /transactions/from-receipt` (preview) → `POST /transactions/from-receipt/confirm` |
| `RECURRING` | Recorrência (cron) | `POST /recurring-transactions` (geração automática) |
| `IMPORTED` | Extrato OFX/CSV | `POST /import/preview` → `POST /import/confirm` |
| `WHATSAPP` | Mensagem no WhatsApp | webhook `POST /whatsapp/webhook` (EvolutionAPI) |
| `NOTIFICATION` | Notificação bancária Android | _planejado — ainda não implementado_ |

---

## Enums (referência)

| Enum | Valores |
|------|---------|
| `TransactionType` | `INCOME`, `EXPENSE` |
| `TransactionStatus` | `PENDING`, `COMPLETED`, `CANCELLED` |
| `TransactionSource` | `MANUAL`, `NOTIFICATION`, `OPEN_BANKING`, `IMPORTED`, `OCR`, `RECURRING`, `WHATSAPP` |
| `CategoryType` | `EXPENSE`, `INCOME`, `TRANSFER` |
| `AccountType` | `CHECKING`, `SAVINGS`, `CREDIT_CARD`, `INVESTMENT` |
| `BudgetPeriod` | `MONTHLY`, `WEEKLY`, `YEARLY` |
| `GoalStatus` | `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `GoalDistributionStrategy` | `PROPORTIONAL`, `SEQUENTIAL`, `PRIORITY`, `MANUAL` |
| `RecurrenceFrequency` | `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY` |
| `NotificationType` | `BUDGET_ALERT`, `BUDGET_EXCEEDED`, `GOAL_ACHIEVED`, `GOAL_MILESTONE`, `BILL_DUE`, `SYSTEM` |
| `AlertPriority` | `CRITICAL`, `WARNING`, `INFO`, `POSITIVE` |
| `Role` | `USER`, `ADMIN`, `SUPER_ADMIN` |
| `SubscriptionTier` | `FREE`, `PRO`, `FAMILY` |
| `RecommendationType` | `REDUCE_EXPENSE`, `OPTIMIZE_BUDGET`, `SAVINGS_OPPORTUNITY`, `RISK_ALERT`, `SUBSCRIPTION_REVIEW` |
| `RecommendationStatus` | `ACTIVE`, `APPLIED`, `DISMISSED`, `EXPIRED` |
| `AiFeatureType` | `CATEGORIZATION`, `PREDICTIVE_ANALYTICS`, `ANOMALY_DETECTION`, `RECOMMENDATIONS`, `OCR`, `BANK_NOTIFICATION`, `ASSISTANT` |
| `FeedbackType` | `BUG`, `SUGGESTION`, `OTHER` |
| `FeedbackStatus` | `PENDING`, `IN_REVIEW`, `RESOLVED`, `REJECTED` |
| `ProjectStatus` | `PLANNING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `ProjectItemStatus` | `PENDING`, `QUOTED`, `PURCHASED`, `CANCELLED` |
| `QuoteStatus` | `PENDING`, `SELECTED`, `REJECTED`, `CONVERTED` |
| `MissionFrequency` | `DAILY`, `WEEKLY`, `MONTHLY`, `ONEOFF`, `DYNAMIC` |

---

## Índice por domínio

| Documento | Conteúdo |
|-----------|----------|
| [auth.md](./auth.md) | Autenticação nativa (JWT), OAuth Google/Apple, sessões, verificação/reset de senha |
| [users.md](./users.md) | Perfil, avatar, troca de senha, exclusão, rotas admin de usuários |
| [accounts.md](./accounts.md) | Contas (carteiras) e saldo total |
| [categories.md](./categories.md) | Categorias (sistema + usuário), hierarquia, estatísticas |
| [transactions.md](./transactions.md) | Transações, filtros, stats, correção de categoria por IA, OCR |
| [budgets.md](./budgets.md) | Orçamentos por categoria e resumo |
| [goals.md](./goals.md) | Metas, hierarquia, contribuições, imagem, links de compra |
| [recurring-transactions.md](./recurring-transactions.md) | Recorrências (salário, contas fixas) |
| [import.md](./import.md) | Importação de extratos OFX/CSV (preview + confirm) |
| [whatsapp.md](./whatsapp.md) | Webhook do WhatsApp (EvolutionAPI) |
| [dashboard-reports-export.md](./dashboard-reports-export.md) | Dashboard home, relatórios e exportação CSV/XLSX/PDF |
| [notifications.md](./notifications.md) | Notificações in-app |
| [projects.md](./projects.md) | Projetos de compra, itens e cotações |
| [insights.md](./insights.md) | Previsões, projeções, análises, cenários, planejamento, fundo de emergência, recomendações, health-score, alertas proativos |
| [ai.md](./ai.md) | Configuração de IA, uso/custos, analytics (forecast, anomalias, tendências) |
| [engajamento.md](./engajamento.md) | Gamificação, onboarding, brands |
| [admin-infra.md](./admin-infra.md) | Admin, feedback, release-notes, auditoria, health, websocket |

---

## Export OpenAPI

Para gerar um contrato máquina-legível (codegen de client tipado, import no Postman/Insomnia):

```bash
npm run openapi:export   # gera docs/handoff/openapi.json
```

> O script sobe o `AppModule` para extrair o documento Swagger, então requer as envs
> configuradas (conecta no banco/Redis no boot, mas **não grava dados**). Os _request
> schemas_ vêm completos dos DTOs; alguns _response schemas_ podem estar vazios (os
> decorators `@ApiResponse` não cobrem todos os endpoints) — para responses, use os `.md`.
