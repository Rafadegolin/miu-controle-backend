# Admin e Infraestrutura

Convenções globais: ver [README](./README.md).

Este documento cobre os domínios administrativos e de infraestrutura: **Admin**
(observabilidade do sistema), **Feedback**, **Release Notes**, **Auditoria**,
**Health & Métricas** e **WebSocket**.

Todas as rotas abaixo são servidas sob o prefixo global versionado **`/api/v1/...`**
(`setGlobalPrefix('api')` + `enableVersioning` URI, `defaultVersion: '1'`). Nenhum
controller deste domínio sobrescreve a versão — inclusive `health`, `audit` e
`websocket` vivem em `/api/v1/...`.

> Formato de erro, mecânica de auth (JWT Bearer), tiers de rate limit e shape de
> paginação cursor são globais — ver [README](./README.md).

---

## Admin

Controller `AdminController` (`@Controller('admin')`). **Todos** os endpoints
exigem JWT + Role `ADMIN`: o controller aplica `@UseGuards(JwtAuthGuard, RolesGuard)`
e `@Roles(Role.ADMIN)` no nível de classe.

### `GET /api/v1/admin/cache-stats`
Estatísticas do cache Redis (hits, misses, hit rate).
- **Auth:** JWT Bearer + Role ADMIN
- **Response (200):**
```jsonc
{
  "hits": 1250,
  "misses": 180,
  "total": 1430,
  "hitRate": 87.41,           // % arredondado a 2 casas
  "timestamp": "2026-06-29T14:00:00.000Z"
}
```
- **Erros:** `401` não autenticado · `403` sem Role ADMIN

### `POST /api/v1/admin/cache-reset`
Zera os contadores de hits/misses do cache (não limpa o conteúdo do cache, só as estatísticas).
- **Auth:** JWT Bearer + Role ADMIN
- **Body:** nenhum
- **Response (201):**
```jsonc
{
  "message": "Cache statistics reset successfully",
  "timestamp": "2026-06-29T14:00:00.000Z"
}
```
> Observação: por ser `@Post()` sem `@HttpCode`, o NestJS retorna **201** por padrão.
- **Erros:** `401` não autenticado · `403` sem Role ADMIN

### `GET /api/v1/admin/slow-queries`
Lista as últimas (até 100) queries Prisma que excederam 200ms, para monitoramento. Mais recente primeiro.
- **Auth:** JWT Bearer + Role ADMIN
- **Response (200):** array de `SlowQuery`
```jsonc
[
  {
    "query": "Transaction.findMany",      // `${model}.${action}`
    "params": "{\"where\":{\"userId\":\"123\"}}", // JSON.stringify dos args
    "duration": 345,                        // ms
    "timestamp": "2026-06-29T13:59:12.000Z"
  }
]
```
- **Erros:** `401` não autenticado · `403` sem Role ADMIN

### `GET /api/v1/admin/dashboard/stats`
Estatísticas gerais do sistema (contadores globais de usuários, assinaturas e transações).
- **Auth:** JWT Bearer + Role ADMIN
- **Response (200):**
```jsonc
{
  "users": { "total": 150, "active": 120 },   // active = isActive: true
  "subscriptions": { "active": 45 },           // status: 'ACTIVE'
  "system": { "transactions": 5420, "health": "OK" }
}
```
- **Erros:** `401` não autenticado · `403` sem Role ADMIN

---

## Feedback

Controller `FeedbackController` (`@Controller('feedback')`). Guards aplicados
**por endpoint** (não há guard de classe): rotas de usuário usam só `JwtAuthGuard`;
rotas `admin/*` somam `RolesGuard` + `@Roles(Role.ADMIN)`.

### `POST /api/v1/feedback`
Envia um feedback (bug, sugestão ou outro). O `userId` vem do token; status inicia em `PENDING`.
- **Auth:** JWT Bearer
- **Body (`CreateFeedbackDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `type` | `FeedbackType` enum | sim | `BUG` \| `SUGGESTION` \| `OTHER` | `"BUG"` |
| `title` | string | sim | não vazio | `"Erro ao salvar transação"` |
| `description` | string | sim | não vazio | `"Ao clicar em salvar, ocorre erro 500..."` |
| `attachments` | string[] | não | array (default `[]`) | `["https://minio.../print.png"]` |

- **Response (201):** registro `Feedback` criado
```jsonc
{
  "id": "uuid",
  "userId": "uuid",
  "type": "BUG",
  "status": "PENDING",
  "title": "Erro ao salvar transação",
  "description": "Ao clicar em salvar, ocorre erro 500...",
  "attachments": ["https://minio.../print.png"],
  "adminResponse": null,
  "adminId": null,
  "createdAt": "2026-06-29T14:00:00.000Z",
  "updatedAt": "2026-06-29T14:00:00.000Z"
}
```
- **Erros:** `400` validação · `401` não autenticado

### `GET /api/v1/feedback/me`
Lista os feedbacks do usuário autenticado, mais recentes primeiro.
- **Auth:** JWT Bearer
- **Response (200):** array de `Feedback` (mesmo shape acima), ordenado por `createdAt desc`
- **Erros:** `401` não autenticado

### `GET /api/v1/feedback/admin/all`
Lista **todos** os feedbacks de todos os usuários (com dados do autor), filtrável.
- **Auth:** JWT Bearer + Role ADMIN
- **Query:**

| Campo | Tipo | Obrigatório | Observações |
|-------|------|-------------|-------------|
| `status` | `FeedbackStatus` enum | não | `PENDING` \| `IN_REVIEW` \| `RESOLVED` \| `REJECTED` |
| `type` | `FeedbackType` enum | não | `BUG` \| `SUGGESTION` \| `OTHER` |

- **Response (200):** array de `Feedback` (ordenado por `createdAt desc`), cada item com `user` embutido:
```jsonc
[
  {
    "id": "uuid",
    "userId": "uuid",
    "type": "BUG",
    "status": "PENDING",
    "title": "Erro ao salvar transação",
    "description": "...",
    "attachments": [],
    "adminResponse": null,
    "adminId": null,
    "createdAt": "2026-06-29T14:00:00.000Z",
    "updatedAt": "2026-06-29T14:00:00.000Z",
    "user": {
      "fullName": "João Silva",
      "email": "user@example.com",
      "avatarUrl": "https://..."
    }
  }
]
```
- **Erros:** `401` não autenticado · `403` sem Role ADMIN

### `PATCH /api/v1/feedback/admin/:id`
Atualiza o status de um feedback e (opcionalmente) registra uma resposta do admin. O `adminId` do respondente vem do token.
- **Auth:** JWT Bearer + Role ADMIN
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `id` | string (uuid) | ID do feedback |

- **Body (`UpdateFeedbackStatusDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `status` | `FeedbackStatus` enum | sim | `PENDING` \| `IN_REVIEW` \| `RESOLVED` \| `REJECTED` | `"RESOLVED"` |
| `adminResponse` | string | não | — | `"Bug corrigido na versão 1.2.1"` |

- **Response (200):** registro `Feedback` atualizado (mesmo shape do POST, com `status`, `adminResponse` e `adminId` preenchidos)
- **Erros:** `400` validação · `401` não autenticado · `403` sem Role ADMIN · `404` feedback inexistente _(inferido — `prisma.update` lança P2025)_

---

## Release Notes

Controller `ReleaseNotesController` (`@Controller('release-notes')`). Controller
**misto**: criação/listagem total são ADMIN; consulta de pendentes e marcação de
leitura são de qualquer usuário autenticado. Guards aplicados por endpoint.

### `POST /api/v1/release-notes`
Cria uma nota de atualização (release note).
- **Auth:** JWT Bearer + Role ADMIN
- **Body (`CreateReleaseNoteDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `version` | string | sim | não vazio · **único** (constraint no banco) | `"1.2.0"` |
| `title` | string | sim | não vazio | `"Novas funcionalidades de IA"` |
| `content` | string | sim | não vazio · Markdown | `"Agora você pode usar a IA para..."` |
| `isActive` | boolean | não | default `true` quando omitido | `true` |

- **Response (201):** registro `ReleaseNote` criado
```jsonc
{
  "id": "uuid",
  "version": "1.2.0",
  "title": "Novas funcionalidades de IA",
  "content": "Agora você pode usar a IA para...",
  "publishedAt": "2026-06-29T14:00:00.000Z",
  "isActive": true
}
```
- **Erros:** `400` validação · `401` não autenticado · `403` sem Role ADMIN · `409`/`500` versão duplicada _(inferido — `version` é `@unique`, P2002)_

### `GET /api/v1/release-notes/all`
Lista **todas** as notas (ativas e inativas), mais recentes primeiro.
- **Auth:** JWT Bearer + Role ADMIN
- **Response (200):** array de `ReleaseNote` (mesmo shape acima), ordenado por `publishedAt desc`
- **Erros:** `401` não autenticado · `403` sem Role ADMIN

### `GET /api/v1/release-notes/pending`
Lista as notas **ativas** ainda não lidas pelo usuário autenticado (para exibir "o que há de novo"), mais recentes primeiro.
- **Auth:** JWT Bearer
- **Response (200):** array de `ReleaseNote` ativas e não lidas pelo usuário (mesmo shape do POST)
- **Erros:** `401` não autenticado

### `POST /api/v1/release-notes/:id/read`
Marca uma nota como lida pelo usuário autenticado (cria o recibo `UserReleaseRead`). Idempotente: se já lida, não falha.
- **Auth:** JWT Bearer
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `id` | string (uuid) | ID da release note |

- **Body:** nenhum
- **Response (201):** recibo `UserReleaseRead` criado **ou**, se já existir, `{ "message": "Already read" }`
```jsonc
// primeira leitura
{
  "id": "uuid",
  "userId": "uuid",
  "releaseNoteId": "uuid",
  "readAt": "2026-06-29T14:00:00.000Z"
}
// já lida (unique constraint userId+releaseNoteId)
{ "message": "Already read" }
```
- **Erros:** `401` não autenticado

---

## Auditoria

Controller `AuditController` (`@Controller('audit')`). `@UseGuards(JwtAuthGuard)`
no nível de classe — **todos** os endpoints exigem JWT (qualquer usuário; não é
restrito a ADMIN). Ambos usam **paginação cursor-based** — ver
[Paginação cursor-based](./README.md#paginação-cursor-based) — e o mesmo
`FilterAuditDto` na query.

Os logs (`AuditLog`) têm o shape:
```jsonc
{
  "id": "uuid",
  "userId": "uuid",          // pode ser null (onDelete: SetNull)
  "action": "CREATE",        // CREATE | UPDATE | DELETE | LOGIN | LOGOUT | REGISTER
  "entity": "TRANSACTION",
  "entityId": "uuid",        // opcional
  "before": null,            // snapshot anterior (Json) — UPDATE/DELETE
  "after": { /* ... */ },    // snapshot posterior (Json) — CREATE/UPDATE
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "createdAt": "2026-06-29T03:30:00.000Z"
}
```

**Query — `FilterAuditDto`** (comum aos dois endpoints):

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `startDate` | string | não | ISO 8601 (`@IsDateString`) | `"2026-01-01T00:00:00.000Z"` |
| `endDate` | string | não | ISO 8601 (`@IsDateString`) | `"2026-12-31T23:59:59.999Z"` |
| `action` | `AuditAction` enum | não | `CREATE` \| `UPDATE` \| `DELETE` \| `LOGIN` \| `LOGOUT` \| `REGISTER` | `"CREATE"` |
| `entity` | `AuditEntity` enum | não | `TRANSACTION` \| `ACCOUNT` \| `CATEGORY` \| `BUDGET` \| `GOAL` \| `USER` \| `NOTIFICATION` \| `AI_CONFIG` \| `RECURRING_TRANSACTION` | `"TRANSACTION"` |
| `take` | number | não | inteiro, 1–100, default `50` | `50` |
| `cursor` | string | não | id do último item da página anterior | `"550e8400-..."` |

> Em `GET /audit/entity/...` o parâmetro `entity` do filtro é ignorado (a entidade
> já vem no path); os demais campos do DTO se aplicam normalmente.

### `GET /api/v1/audit/me`
Histórico de auditoria do usuário autenticado (filtra por `userId` do token). Ordenado por `createdAt desc`.
- **Auth:** JWT Bearer
- **Query:** `FilterAuditDto` (tabela acima)
- **Response (200):** envelope cursor — `items` são `AuditLog` **sem** relação `user`
```jsonc
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "123e4567-...",
      "action": "CREATE",
      "entity": "TRANSACTION",
      "entityId": "789e4567-...",
      "before": null,
      "after": { "id": "789e4567-...", "amount": 100.0, "description": "Compra no supermercado" },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-06-29T03:30:00.000Z"
    }
  ],
  "nextCursor": "550e8400-e29b-41d4-a716-446655440001",
  "hasMore": true
}
```
- **Erros:** `400` query inválida · `401` não autenticado

### `GET /api/v1/audit/entity/:entity/:entityId`
Histórico completo de mudanças de uma entidade específica ("quem alterou o quê"). Não é filtrado por `userId`. Ordenado por `createdAt desc`.
- **Auth:** JWT Bearer
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `entity` | `AuditEntity` enum | Tipo da entidade (ex.: `TRANSACTION`) |
| `entityId` | string (uuid) | ID da entidade |

- **Query:** `FilterAuditDto` (campo `entity` do DTO é redundante aqui)
- **Response (200):** envelope cursor — neste endpoint cada `AuditLog` inclui a relação `user` (`id`, `email`, `fullName`)
```jsonc
{
  "items": [
    {
      "id": "550e8400-...-002",
      "userId": "123e4567-...",
      "action": "UPDATE",
      "entity": "TRANSACTION",
      "entityId": "789e4567-...",
      "before": { "amount": 100.0, "description": "Compra no supermercado" },
      "after": { "amount": 150.0, "description": "Compra no supermercado (atualizado)" },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-06-29T04:00:00.000Z",
      "user": { "id": "123e4567-...", "email": "user@example.com", "fullName": "João Silva" }
    }
  ],
  "nextCursor": null,
  "hasMore": false
}
```
- **Erros:** `400` query/entity inválida · `401` não autenticado

---

## Health & Métricas

Controller `HealthController` (`@Controller('health')`). **`@SkipThrottle()`** no
nível de classe — todos os endpoints são **públicos** (sem JWT) e **sem rate limit**.
Os health checks usam `@nestjs/terminus`. Apesar de serem probes de infra, ficam
sob o prefixo versionado: **`/api/v1/health...`**.

### `GET /api/v1/health`
Health check completo: verifica banco (Prisma ping), heap de memória (limite 512MB) e disco (limite 90% de uso).
- **Auth:** Público
- **Rate limit:** sem limite (`@SkipThrottle`)
- **Response (200) — saudável:** formato Terminus
```jsonc
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up" },
    "storage": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "memory_heap": { "status": "up" },
    "storage": { "status": "up" }
  }
}
```
- **Erros:** `503` Service Unavailable se algum check falhar (Terminus retorna `status: "error"` com os detalhes) _(inferido — comportamento padrão Terminus)_

### `GET /api/v1/health/live`
Liveness probe (Kubernetes): retorna ok se o processo está rodando. Não checa dependências.
- **Auth:** Público
- **Rate limit:** sem limite (`@SkipThrottle`)
- **Response (200):**
```jsonc
{ "status": "ok", "info": {}, "error": {}, "details": {} }
```
- **Erros:** —

### `GET /api/v1/health/ready`
Readiness probe (Kubernetes): só aceita tráfego se o banco (Prisma ping) estiver OK.
- **Auth:** Público
- **Rate limit:** sem limite (`@SkipThrottle`)
- **Response (200):**
```jsonc
{
  "status": "ok",
  "info": { "database": { "status": "up" } },
  "error": {},
  "details": { "database": { "status": "up" } }
}
```
- **Erros:** `503` Service Unavailable se o banco estiver indisponível _(inferido — comportamento padrão Terminus)_

### `GET /api/v1/health/metrics`
Métricas da aplicação para monitoramento (contadores de usuários/transações, uso de memória, latência média e contagem de requisições). Servido por `MetricsService`.
- **Auth:** Público
- **Rate limit:** sem limite (`@SkipThrottle`)
- **Response (200):**
```jsonc
{
  "application": {
    "name": "Miu Controle API",
    "version": "1.0.0",
    "uptime": 12345,                 // segundos (process.uptime())
    "environment": "production"      // NODE_ENV (default "development")
  },
  "database": {
    "totalUsers": 150,
    "totalTransactions": 5420,
    "todayTransactions": 25          // criadas desde 00:00 de hoje
  },
  "performance": {
    "totalRequests": 10523,
    "averageLatency": 45,            // ms (média das últimas até 1000 amostras)
    "memoryUsage": { /* process.memoryUsage(): rss, heapTotal, heapUsed, external, arrayBuffers */ }
  },
  "timestamp": "2026-06-29T14:00:00.000Z"
}
```
- **Erros:** —

---

## WebSocket

Controller `WebsocketController` (`@Controller('websocket')`). Detalhes do
handshake Socket.IO e dos eventos emitidos estão no [README — seção WebSocket](./README.md#websocket-tempo-real).

### `GET /api/v1/websocket/status`
Status atual do servidor WebSocket (número de conexões e usuários conectados). Útil para debugging/monitoramento.
- **Auth:** JWT Bearer
- **Response (200):**
```jsonc
{
  "totalConnections": 12,           // sockets ativos
  "connectedUsers": ["uuid", "uuid"], // userIds com sala user:<id> ativa
  "timestamp": "2026-06-29T14:00:00.000Z"
}
```
- **Erros:** `401` não autenticado
