# Migração do Frontend → novo backend `/api/v1`

Guia de **breaking changes** para alinhar o `miu-controle-frontend` (e depois o
`miu-controle-mobile`) ao backend refatorado. Os demais arquivos em `docs/handoff/`
descrevem o **estado novo** (contrato); **este** descreve **o que mudou vs. a versão
antiga** — é o que você precisa para o refactor.

> **Fonte da verdade:** `docs/handoff/README.md`, os `.md` por domínio e o
> `openapi.json`. Em conflito, eles prevalecem sobre este guia.

---

## 1. Mudança global e obrigatória: versionamento `/api/v1`

Antes, o front chamava paths sem prefixo (`/transactions`, `/auth/login`, ...).
**Agora tudo é `/api/v1/...`.** Exceção: o OAuth do Better Auth continua em
`/api/auth/*` (sem `v1`).

Como o front centraliza tudo em `src/services/api-client.ts`, a correção principal é
num lugar só:

```ts
// src/services/api-client.ts  (ANTES)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
export const apiClient = axios.create({ baseURL: API_BASE_URL, ... });
// ...
const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });

// (DEPOIS)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"; // porta correta do backend
const API_V1 = `${API_BASE_URL}/api/v1`;
export const apiClient = axios.create({ baseURL: API_V1, ... });
// ...
const response = await axios.post(`${API_V1}/auth/refresh`, { refreshToken });
```

Assim, todos os `*.actions.ts` que usam `apiClient` passam a bater em `/api/v1`
automaticamente — **sem** precisar editar cada chamada.

**Atenção OAuth:** chamadas ao Better Auth (`/api/auth/signin/google|apple`,
`get-session`) devem usar `${API_BASE_URL}/api/auth/...` **cru** (não o `apiClient`,
senão herdam o `/api/v1`). Só o `POST /auth/google/exchange` e `/auth/apple/exchange`
usam o `apiClient` (são `/api/v1/auth/...`).

---

## 2. Removido (apagar do front — não existe mais)

| Antes | Situação | O que fazer no front |
|---|---|---|
| Módulo **multi-moeda** (`/currencies`, `/exchange-rates`) | **Removido** | Apagar `services/currencies.actions.ts` e `services/exchange-rates.actions.ts` e qualquer UI de moeda/câmbio. `Account.currency` continua existindo como string fixa `"BRL"`. |
| **Simulador de inflação** (`/inflation-simulator` ou `/simulations/inflation`) | **Removido** | Apagar `services/inflation.actions.ts` e a UI relacionada. |
| `GET /ai/analytics/financial-health` | **Removido** (duplicava) | Usar **`GET /health-score`** (0–1000, com `breakdown` e `level`). Ajustar `services/health-score.actions.ts` (remover `FinancialHealthResponse`). |
| `POST /scenarios/compare` | **Removido** (era placeholder) | Remover qualquer chamada; não há substituto. |
| `POST /notifications/test` | **Removido** | Remover (era endpoint de teste). |

## 3. Movido / renomeado

| Antes | Agora |
|---|---|
| `POST /affordability/check` (módulo próprio) | **`POST /scenarios/affordability`** (mesmo DTO/response, sem o campo `alternatives`). Migrar `services/affordability.actions.ts` para dentro de `scenarios.actions.ts` (ou reapontar). |

## 4. Campos de response removidos (ajustar tipos/UI)

- **`ScenarioResultDto`**: removido `alternativeScenarios`. Em compensação, **`impactedGoals` agora vem preenchido** (lista de metas em risco) — dá para exibir de verdade.
- **`AffordabilityResultDto`**: removido `alternatives`. O `breakdown` continua (incluindo `historyScore`, que agora é calculado de verdade).

## 5. Novidades (implementar no front)

| Novo | Endpoints | UX |
|---|---|---|
| **Importação OFX/CSV** | `POST /import/preview` (multipart `file` + opções) → `POST /import/confirm` | Upload → (CSV) mapear colunas → preview com resumo/duplicatas → confirmar. Ver `docs/handoff/import.md`. |
| **OCR — salvar de fato** | `POST /transactions/from-receipt` (preview) → **`POST /transactions/from-receipt/confirm`** | Antes o OCR só dava preview; agora confirma e persiste (`source=OCR`). Ver `transactions.md`. |
| **WhatsApp** | webhook (backend) | Sem chamada de API no front — apenas uma tela explicando como conectar/usar; transações chegam com `source=WHATSAPP`. |

## 6. Enum `TransactionSource` — novos valores

Passou a incluir **`RECURRING`, `WHATSAPP`, `OCR`, `IMPORTED`** (além de `MANUAL`,
`NOTIFICATION`, `OPEN_BANKING`). Exiba um **badge de origem** em cada transação. (Ver
tabela de vias em `README.md`.)

## 7. Mudanças de comportamento

- **Onboarding** agora exige **JWT** (antes dava 500). Chame `/onboarding/*` autenticado.
- **`POST /proactive-alerts/run-checks`** agora é **somente ADMIN** (era exposto). Esconder do usuário comum.
- **`POST /planning/goal/:goalId/save`** agora tem DTO tipado (`SavePlanDto`: `monthlyDeposit`, `months`, `isViable`, `margin`, `recommendations[]`, `actionPlan[]`, `suggestedCuts[]`) — envie exatamente esses campos (o backend valida com whitelist estrita e descarta campos extras).
- **Validação estrita global:** enviar campo não previsto no DTO → **400** com `message` em **array**. Trate erros por campo nos forms.
- **Status de orçamento:** `GET /budgets` usa `OK/WARNING/EXCEEDED` (maiúsculas), mas o bloco `budgets` do `GET /dashboard/home` usa `ok/warning/exceeded` (minúsculas) — **normalize no front**.

## 8. Convenções que o front deve respeitar (ver `README.md`)

- **Paginação cursor** em listas grandes (transações, notificações, auditoria):
  `{ items, nextCursor, hasMore }` → use `useInfiniteQuery` com
  `getNextPageParam = (last) => last.nextCursor`.
- **Erros:** `429` traz `retryAfter`; `408` = timeout (30s). Toasts amigáveis.
- **WebSocket** (Socket.IO, `auth: { token }`): eventos `transaction.created/updated/deleted`,
  `balance.updated`, `notification.new`, `budget.alert`, `goal.milestone` → **invalidar as
  queries** correspondentes do React Query. (O repo já tem `SocketContext`.)

## 9. Arquivos do frontend a mexer (mapa rápido)

- **`src/services/api-client.ts`** — baseURL `→ /api/v1` (seção 1); porta default `3001`; refresh URL.
- **Apagar:** `currencies.actions.ts`, `exchange-rates.actions.ts`, `inflation.actions.ts`.
- **Reapontar:** `affordability.actions.ts` → `POST /scenarios/affordability` (ou mover para `scenarios.actions.ts`).
- **Ajustar:** `health-score.actions.ts` (usar `/health-score`, remover `FinancialHealthResponse`); `scenarios.actions.ts` (remover `alternativeScenarios`); `transactions.actions.ts` (adicionar OCR confirm + campos de recibo); criar `import.actions.ts`.
- **`src/types/api.ts`** — regenerar a partir do `openapi.json` (ex.: `openapi-typescript`) ou alinhar manualmente (novos enums de `source`, remoção de tipos de moeda/inflação/financial-health).
- **Rotas a revisar** (App Router): `/dashboard/financial-health` → passar a consumir `/health-score`; `/dashboard/investments` e `/dashboard/sync` → **verificar** (não há endpoint dedicado no backend; "investments" = contas do tipo `INVESTMENT`, e não há sincronização/Open Finance). Remover páginas órfãs de moeda/inflação, se existirem.

---

## 10. Prompt pronto para colar no Claude Code do frontend

> Você está no repositório `miu-controle-frontend` (Next.js 16 + Tailwind v4 + React Query + axios). O backend foi refatorado, versionado para `/api/v1` e documentado em `docs/handoff/` (copie essa pasta para cá ou aponte o caminho). Sua tarefa: **alinhar 100% o frontend ao novo contrato**, sem quebrar a build.
>
> 1. Leia `docs/handoff/README.md` (convenções) e o `MIGRACAO-FRONTEND.md` (este guia de breaking changes). Use o `openapi.json` como fonte de tipos.
> 2. **Versione a API:** ajuste `src/services/api-client.ts` para `baseURL = ${NEXT_PUBLIC_API_URL}/api/v1` (e o refresh para `/api/v1/auth/refresh`); mantenha as chamadas OAuth do Better Auth em `/api/auth/*` (sem `v1`).
> 3. **Remova o descontinuado:** apague os services de `currencies`, `exchange-rates`, `inflation`; remova chamadas a `/ai/analytics/financial-health` (use `/health-score`), `/scenarios/compare` e `/notifications/test`.
> 4. **Reaponte** `affordability` para `POST /scenarios/affordability`.
> 5. **Implemente as novidades:** importação OFX/CSV (`/import/preview` + `/import/confirm`), OCR confirm (`/transactions/from-receipt/confirm`), e o badge de `source` (incl. RECURRING/WHATSAPP/OCR/IMPORTED).
> 6. **Ajuste tipos e comportamento:** regenere `src/types/api.ts` do `openapi.json`; trate paginação cursor, erros (400 array/429/408), e invalidação de React Query pelos eventos WebSocket.
> 7. **Corrija comportamentos:** onboarding autenticado; `run-checks` só ADMIN; `planning/save` com os campos do `SavePlanDto`; normalize o casing do status de orçamento.
> 8. Rode o type-check/build e liste o que mudou. Em conflito entre este guia e `docs/handoff/`, **`docs/handoff/` prevalece** — e me avise.

---

## 11. Checklist de validação (frontend)

- [ ] Nenhuma chamada sem `/api/v1` (exceto `/api/auth/*` do OAuth).
- [ ] Zero referências a currencies/exchange-rates/inflation/financial-health/compare/notifications-test.
- [ ] `affordability` aponta para `/scenarios/affordability`.
- [ ] Importação OFX/CSV e OCR-confirm funcionando; badge de `source` em transações.
- [ ] Tipos regenerados do `openapi.json`; `npm run build` / type-check verdes.
- [ ] Paginação cursor, tratamento de erro e realtime (WebSocket) revisados.
- [ ] Onboarding autenticado; áreas ADMIN escondidas do usuário comum.
