# Engajamento

Convenções globais: ver [README](./README.md).

Este documento cobre os domínios de engajamento: **Gamificação** (XP, nível, streak, missões), **Onboarding** (passos e finalização) e **Brands** (catálogo de marcas para detecção em transações).

> **Nota de segurança (Brands):** o `BrandsController` aplica apenas `@UseGuards(RolesGuard)` no nível da classe — **não** há `JwtAuthGuard`. O `RolesGuard` lê `req.user`, mas como nenhum guard popula `req.user` neste controller, as rotas marcadas com `@Roles(Role.ADMIN)` ficam efetivamente **inacessíveis** (o `user` é `undefined`, então nenhuma role corresponde). As rotas **sem** `@Roles` (listar/buscar) passam livremente, pois o `RolesGuard` retorna `true` quando nenhuma role é exigida. Isso está documentado abaixo como observado no código.

---

## Gamificação

Controller: `src/gamification/gamification.controller.ts` — base `@Controller('gamification')` com `@UseGuards(JwtAuthGuard)` na classe (todas as rotas exigem JWT). As rotas `admin/*` exigem adicionalmente `RolesGuard` + `@Roles(Role.ADMIN)`.

### `GET /api/v1/gamification/profile`
Retorna o perfil de gamificação do usuário autenticado (XP, nível, streak e progresso até o próximo nível).
- **Auth:** JWT Bearer
- **Response (200):** _(inferido — validar)_ — montado em `GamificationService.getProfile` a partir dos campos `level`, `currentXp`, `streakCurrent`, `streakLongest` do `User`, acrescido de `nextLevelXp` e `progress` calculados.

```jsonc
{
  "level": 3,              // Int (User.level, default 1)
  "currentXp": 450,        // Int (User.currentXp, default 0)
  "streakCurrent": 5,      // Int (User.streakCurrent, default 0)
  "streakLongest": 12,     // Int (User.streakLongest, default 0)
  "nextLevelXp": 3000,     // Int = level * 1000
  "progress": 15           // Int = floor(currentXp / nextLevelXp * 100)
}
```
- **Erros:** `401` (sem/JWT inválido).

### `GET /api/v1/gamification/missions`
Lista as missões ativas do usuário. Antes de retornar, garante que o usuário tenha missões semanais (gera/semeia automaticamente se ainda não houver missões na semana corrente).
- **Auth:** JWT Bearer
- **Response (200):** _(inferido — validar)_ — array de `UserMission` (status `ACTIVE`) com a `mission` (template) incluída, ordenado por `createdAt desc`.

```jsonc
[
  {
    "id": "uuid",
    "userId": "uuid",
    "missionId": "uuid",
    "status": "ACTIVE",          // MissionStatus: ACTIVE | COMPLETED | EXPIRED | FAILED
    "progress": 2,               // Int — contagem atual
    "target": 5,                 // Int — snapshot do alvo na criação
    "completedAt": null,         // ISO 8601 | null
    "expiresAt": "2026-07-04T00:00:00.000Z", // ISO 8601 | null
    "createdAt": "2026-06-27T12:00:00.000Z",
    "updatedAt": "2026-06-27T12:00:00.000Z",
    "mission": {
      "id": "uuid",
      "code": "WEEKLY_TX_5",
      "title": "Registro Constante",
      "description": "Faça 5 transações esta semana",
      "xpReward": 100,           // Int
      "frequency": "WEEKLY",     // MissionFrequency: DAILY | WEEKLY | MONTHLY | ONEOFF | DYNAMIC
      "criteria": { "type": "TRANSACTION_COUNT", "target": 5 }, // Json
      "isActive": true,
      "createdAt": "2026-06-27T12:00:00.000Z",
      "updatedAt": "2026-06-27T12:00:00.000Z"
    }
  }
]
```
- **Erros:** `401`.

### `POST /api/v1/gamification/admin/missions`
Cria uma nova template de missão (operação administrativa).
- **Auth:** JWT Bearer + Role ADMIN (`RolesGuard` + `@Roles(Role.ADMIN)`)
- **Body (`CreateMissionDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `code` | string | sim | `@IsString`, `@IsNotEmpty` | `"TX_5"` |
| `title` | string | sim | `@IsString`, `@IsNotEmpty` | `"Registro Diário"` |
| `description` | string | sim | `@IsString`, `@IsNotEmpty` | `"Faça 5 transações"` |
| `xpReward` | number | sim | `@IsNumber` | `100` |
| `frequency` | enum | sim | `@IsEnum(MissionFrequency)` — `DAILY` \| `WEEKLY` \| `MONTHLY` \| `ONEOFF` \| `DYNAMIC` | `"WEEKLY"` |
| `criteria` | object (Json) | sim | `@IsObject` | `{ "type": "TRANSACTION_COUNT", "target": 5 }` |

- **Response (201):** _(inferido — validar)_ — objeto `Mission` recém-criado (`prisma.mission.create`).

```jsonc
{
  "id": "uuid",
  "code": "TX_5",
  "title": "Registro Diário",
  "description": "Faça 5 transações",
  "xpReward": 100,
  "frequency": "WEEKLY",
  "criteria": { "type": "TRANSACTION_COUNT", "target": 5 },
  "isActive": true,
  "createdAt": "2026-06-27T12:00:00.000Z",
  "updatedAt": "2026-06-27T12:00:00.000Z"
}
```
- **Erros:** `400` (validação / `code` duplicado viola `@unique`), `401`, `403` (sem Role ADMIN).

### `GET /api/v1/gamification/admin/missions/templates`
Lista todas as templates de missões cadastradas (operação administrativa).
- **Auth:** JWT Bearer + Role ADMIN (`RolesGuard` + `@Roles(Role.ADMIN)`)
- **Response (200):** _(inferido — validar)_ — array de `Mission` ordenado por `title asc` (`prisma.mission.findMany`).

```jsonc
[
  {
    "id": "uuid",
    "code": "WEEKLY_TX_5",
    "title": "Registro Constante",
    "description": "Faça 5 transações esta semana",
    "xpReward": 100,
    "frequency": "WEEKLY",
    "criteria": { "type": "TRANSACTION_COUNT", "target": 5 },
    "isActive": true,
    "createdAt": "2026-06-27T12:00:00.000Z",
    "updatedAt": "2026-06-27T12:00:00.000Z"
  }
]
```
- **Erros:** `401`, `403` (sem Role ADMIN).

---

## Onboarding

Controller: `src/onboarding/onboarding.controller.ts` — base `@Controller('onboarding')` com `@UseGuards(JwtAuthGuard)` + `@ApiBearerAuth()` na classe. **Todas** as rotas exigem JWT Bearer.

### `GET /api/v1/onboarding/status`
Obtém o status de onboarding do usuário autenticado.
- **Auth:** JWT Bearer
- **Response (200):** _(inferido — validar)_ — subconjunto do `User` selecionado em `OnboardingService.getStatus`.

```jsonc
{
  "hasCompletedOnboarding": false, // Boolean (default false)
  "onboardingStep": 2,             // Int (default 0)
  "fullName": "Gabriel Silva",     // string
  "avatarUrl": "https://..."       // string | null
}
```
- **Erros:** `401`.

### `POST /api/v1/onboarding/step`
Atualiza o passo atual do onboarding do usuário.
- **Auth:** JWT Bearer
- **Body (`UpdateOnboardingStepDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `step` | number (int) | sim | `@IsInt`, `@Min(0)`, `@Max(6)` | `2` |

- **Response (200/201):** _(inferido — validar)_ — objeto `User` atualizado (`prisma.user.update` com `onboardingStep`). Retorna o registro completo do usuário do Prisma.
- **Erros:** `400` (validação — `step` fora de 0–6 ou não-inteiro), `401`.

### `POST /api/v1/onboarding/complete`
Finaliza o onboarding: salva preferências do usuário, faz upsert da config de IA, cria uma meta inicial padrão (se o usuário não tiver metas) e concede 200 XP. Se já estiver concluído, apenas retorna mensagem informativa.
- **Auth:** JWT Bearer
- **Body (`CompleteOnboardingDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `theme` | string | não | `@IsString`, `@IsOptional` | `"neon"` |
| `displayName` | string | não | `@IsString`, `@IsOptional` | `"Gabriel Silva"` |
| `monthlyIncome` | number | não | `@IsNumber`, `@IsOptional` | `2500` |
| `avatarUrl` | string | não | `@IsString`, `@IsOptional` | `"https://bucket-url/avatar.png"` |
| `language` | string | não | `@IsString`, `@IsOptional` | `"pt-BR"` |
| `preferredCurrency` | string | não | `@IsString`, `@IsOptional` | `"BRL"` |
| `isAiEnabled` | boolean | não | `@IsBoolean`, `@IsOptional` | `true` |
| `aiPersonality` | string | não | `@IsString`, `@IsOptional`, `@IsIn(['conservative','investor','educator'])` | `"investor"` |

> Observação: defaults aplicados no service quando o campo não é enviado — `theme: 'system'`, `language: 'pt-BR'`, `preferredCurrency: 'BRL'`, `aiPersonality: 'educator'`, `isAiEnabled: true`.

- **Response (200/201):** retornos distintos conforme o estado:

```jsonc
// Onboarding concluído com sucesso (primeira vez)
{ "success": true, "message": "Onboarding concluído com sucesso!" }
```
```jsonc
// Já havia sido concluído anteriormente
{ "message": "Onboarding já concluído anteriormente." }
```
- **Erros:** `400` (validação; ou `Usuário não encontrado` via `BadRequestException`), `401`.

---

## Brands (marcas)

Controller: `src/brands/brands.controller.ts` — base `@Controller('brands')` com `@UseGuards(RolesGuard)` na classe (**sem** `JwtAuthGuard`). Marcas representam o catálogo usado para detecção automática de marca em descrições de transações (`matchPatterns`).

> Ver nota de segurança no topo: as rotas com `@Roles(Role.ADMIN)` exigem `req.user.role === ADMIN`, porém nenhum guard popula `req.user` neste controller — na prática essas rotas retornam `403`. As rotas de leitura (sem `@Roles`) são efetivamente **públicas**.

### `POST /api/v1/brands`
Cria uma nova marca.
- **Auth:** Role ADMIN (`RolesGuard` + `@Roles(Role.ADMIN)`) — ver nota de segurança
- **Body (`CreateBrandDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `name` | string | sim | `@IsString`, `@IsNotEmpty` (único no banco) | `"Netflix"` |
| `slug` | string | sim | `@IsString`, `@IsNotEmpty` (único no banco) | `"netflix"` |
| `website` | string | não | `@IsString`, `@IsOptional`, `@IsUrl` | `"https://netflix.com"` |
| `matchPatterns` | string[] | sim | `@IsArray`, `@IsString({ each: true })` | `["netflix", "nflx"]` |
| `logoUrl` | string | não | `@IsString`, `@IsOptional` | `"https://.../logo.png"` |

> No service, `logoUrl` ausente é persistido como string vazia (`''`).

- **Response (201):** _(inferido — validar)_ — objeto `Brand` criado.

```jsonc
{
  "id": "uuid",
  "name": "Netflix",
  "slug": "netflix",
  "logoUrl": "",
  "website": "https://netflix.com", // string | null
  "matchPatterns": ["netflix", "nflx"],
  "isSystem": false,
  "createdAt": "2026-06-27T12:00:00.000Z",
  "updatedAt": "2026-06-27T12:00:00.000Z"
}
```
- **Erros:** `400` (validação; `name`/`slug` duplicado viola `@unique`), `403`.

### `GET /api/v1/brands`
Lista todas as marcas, ordenadas por `name asc`.
- **Auth:** Público (sem `@Roles`; `RolesGuard` libera) — ver nota de segurança
- **Response (200):** _(inferido — validar)_ — array de `Brand` (mesmo shape do `POST`).
- **Erros:** —

### `GET /api/v1/brands/:id`
Busca uma marca por ID.
- **Auth:** Público (sem `@Roles`)
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `id` | string (uuid) | ID da marca |

- **Response (200):** _(inferido — validar)_ — objeto `Brand` ou `null` quando não encontrado (`prisma.brand.findUnique` não lança 404).
- **Erros:** —

### `PATCH /api/v1/brands/:id`
Atualiza uma marca existente.
- **Auth:** Role ADMIN (`RolesGuard` + `@Roles(Role.ADMIN)`) — ver nota de segurança
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `id` | string (uuid) | ID da marca |

- **Body (`UpdateBrandDto`):** `PartialType(CreateBrandDto)` — todos os campos do `CreateBrandDto` tornam-se **opcionais**, mantendo as mesmas validações quando presentes.

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `name` | string | não | `@IsString`, `@IsNotEmpty` | `"Netflix"` |
| `slug` | string | não | `@IsString`, `@IsNotEmpty` | `"netflix"` |
| `website` | string | não | `@IsString`, `@IsUrl` | `"https://netflix.com"` |
| `matchPatterns` | string[] | não | `@IsArray`, `@IsString({ each: true })` | `["netflix"]` |
| `logoUrl` | string | não | `@IsString` | `"https://.../logo.png"` |

- **Response (200):** _(inferido — validar)_ — objeto `Brand` atualizado.
- **Erros:** `400` (validação), `403`, `404` (Prisma `P2025` se o ID não existir).

### `DELETE /api/v1/brands/:id`
Remove (hard delete) uma marca.
- **Auth:** Role ADMIN (`RolesGuard` + `@Roles(Role.ADMIN)`) — ver nota de segurança
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `id` | string (uuid) | ID da marca |

- **Response (200):** _(inferido — validar)_ — objeto `Brand` removido (`prisma.brand.delete`).
- **Erros:** `403`, `404` (Prisma `P2025` se o ID não existir).

### `POST /api/v1/brands/:id/logo`
Faz upload do logo da marca (multipart) e atualiza `logoUrl` com a URL gerada pelo `UploadService` (pasta `logos`, prefixo `brand-logos`).
- **Auth:** Role ADMIN (`RolesGuard` + `@Roles(Role.ADMIN)`) — ver nota de segurança
- **Content-Type:** `multipart/form-data` (`@ApiConsumes`, `FileInterceptor('file')`)
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `id` | string (uuid) | ID da marca |

- **Body (multipart):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `file` | arquivo binário | sim | `MaxFileSizeValidator` (máx **5MB**), `FileTypeValidator` (`.png`, `.jpeg`, `.jpg`, `.webp`) | imagem do logo |

- **Response (201):** _(inferido — validar)_ — objeto `Brand` atualizado com o novo `logoUrl`.
- **Erros:** `400` (arquivo ausente / tamanho > 5MB / tipo inválido — via `ParseFilePipe`), `403`, `404`.

### `POST /api/v1/brands/check-pattern`
Testa, de forma síncrona, se um padrão de texto detecta uma descrição (verificação de substring case-insensitive — espelha a lógica de detecção do service). Não acessa o banco.
- **Auth:** Role ADMIN (`RolesGuard` + `@Roles(Role.ADMIN)`) — ver nota de segurança
- **Body (objeto inline — sem DTO formal):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `pattern` | string | sim | nenhuma (sem class-validator; tipo inline `{ pattern: string; text: string }`) | `"netflix"` |
| `text` | string | sim | nenhuma | `"Compra NETFLIX.COM"` |

> Atenção: como não há DTO com class-validator, a validação global estrita (`whitelist`/`forbidNonWhitelisted`) não se aplica a este body; campos extras não são rejeitados pelo pipe de validação.

- **Response (201):**

```jsonc
{
  "match": true,        // boolean — text.toLowerCase().includes(pattern.toLowerCase())
  "pattern": "netflix",
  "text": "Compra NETFLIX.COM"
}
```
- **Erros:** `403`.
