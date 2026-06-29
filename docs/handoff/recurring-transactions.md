# Transações Recorrentes

Convenções globais: ver [README](./README.md).

Modelos de lançamento que se repetem (salário, aluguel, contas fixas). Um cron diário (06h) gera as transações devidas; também é possível gerar manualmente. As transações geradas têm **`source = RECURRING`** e ficam ligadas à recorrência (`recurringTransactionId`). Todas as rotas exigem **JWT Bearer** e operam apenas sobre recorrências do próprio usuário.

> **Geração automática:** a cada dia às 06h, recorrências `isActive && autoCreate` com `nextOccurrence <= hoje` (e dentro de `endDate`) geram uma transação, atualizam `lastProcessedDate`/`nextOccurrence` e desativam-se automaticamente quando passam de `endDate`. A geração atualiza o saldo da conta (mas, no cron, **não** emite eventos WebSocket).

---

### `POST /api/v1/recurring-transactions`
Cria uma recorrência. Valida conta/categoria e exige campos por frequência; calcula a primeira `nextOccurrence`.
- **Auth:** JWT Bearer
- **Body (`CreateRecurringTransactionDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `accountId` | string | Sim | conta deve existir e ser do usuário | `"uuid-da-conta"` |
| `categoryId` | string | Não | se informada, deve existir | `"uuid-da-categoria"` |
| `type` | enum `TransactionType` | Sim | `INCOME` \| `EXPENSE` | `"EXPENSE"` |
| `amount` | number | Sim | ≥ 0.01 | `1500.0` |
| `description` | string | Sim | máx. 500 | `"Aluguel mensal"` |
| `merchant` | string | Não | — | `"Imobiliária XYZ"` |
| `frequency` | enum `RecurrenceFrequency` | Sim | `DAILY`\|`WEEKLY`\|`MONTHLY`\|`YEARLY` | `"MONTHLY"` |
| `interval` | number | Não | inteiro ≥ 1; default 1 (a cada X períodos) | `1` |
| `dayOfMonth` | number | Condicional | inteiro 1–31; **obrigatório** para `MONTHLY`/`YEARLY` | `5` |
| `dayOfWeek` | number | Condicional | inteiro 0–6 (0=Domingo); **obrigatório** para `WEEKLY` | `1` |
| `startDate` | string (ISO date) | Sim | ISO 8601 | `"2024-01-01"` |
| `endDate` | string (ISO date) | Não | ISO 8601; deve ser posterior a `startDate`; null = sem fim | `"2024-12-31"` |
| `autoCreate` | boolean | Não | default `true` (gerar automaticamente no cron) | `true` |
| `tags` | string[] | Não | — | `["fixo","mensal"]` |
| `notes` | string | Não | — | `"Vence todo dia 5"` |

- **Response (201):** objeto `RecurringTransaction` Prisma com relações:
```jsonc
{
  "id": "uuid",
  "userId": "uuid",
  "accountId": "uuid",
  "categoryId": "uuid",        // ou null
  "type": "EXPENSE",
  "amount": 1500,              // número
  "description": "Aluguel mensal",
  "merchant": "Imobiliária XYZ",
  "frequency": "MONTHLY",
  "interval": 1,
  "dayOfMonth": 5,
  "dayOfWeek": null,
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-12-31T00:00:00.000Z",   // ou null
  "nextOccurrence": "2024-02-05T00:00:00.000Z",
  "lastProcessedDate": null,
  "autoCreate": true,
  "isActive": true,
  "tags": ["fixo"],
  "notes": "Vence todo dia 5",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "account":  { "id": "uuid", "name": "Carteira", "type": "CHECKING" },
  "category": { "id": "uuid", "name": "Moradia", "color": "#...", "icon": "..." } // ou null
}
```
- **Erros:** `400` validação / `dayOfMonth` ou `dayOfWeek` ausente para a frequência / `endDate <= startDate` · `404` conta ou categoria não encontrada.

---

### `GET /api/v1/recurring-transactions`
Lista as recorrências do usuário (ordenadas por `nextOccurrence asc`). **Sem paginação** — retorna array direto.
- **Auth:** JWT Bearer
- **Query (`FilterRecurringTransactionDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `type` | enum `TransactionType` | Não | `INCOME` \| `EXPENSE` | `"EXPENSE"` |
| `frequency` | enum `RecurrenceFrequency` | Não | `DAILY`\|`WEEKLY`\|`MONTHLY`\|`YEARLY` | `"MONTHLY"` |
| `isActive` | boolean | Não | `"true"`/`"false"` (string transformada) | `true` |

- **Response (200):** array de `RecurringTransaction`, cada um com `account` (id, name, type, color), `category` (id, name, color, icon ou null) e `_count.generatedTransactions`:
```jsonc
[
  {
    "id": "uuid",
    "type": "EXPENSE",
    "amount": 1500,
    "description": "Aluguel mensal",
    "frequency": "MONTHLY",
    "nextOccurrence": "2024-02-05T00:00:00.000Z",
    "isActive": true,
    "account":  { "id": "uuid", "name": "Carteira", "type": "CHECKING", "color": "#..." },
    "category": { "id": "uuid", "name": "Moradia", "color": "#...", "icon": "..." },
    "_count":   { "generatedTransactions": 3 }
    // ... demais campos do modelo
  }
]
```

---

### `GET /api/v1/recurring-transactions/:id`
Busca uma recorrência por ID, com as últimas 20 transações geradas e a contagem total.
- **Auth:** JWT Bearer
- **Path params:** `id` (string).
- **Response (200):** objeto `RecurringTransaction` com `account`, `category`, `generatedTransactions` (até 20, `date desc`) e `_count.generatedTransactions`.
- **Erros:** `403` não pertence ao usuário · `404` não encontrada.

---

### `PATCH /api/v1/recurring-transactions/:id`
Atualiza uma recorrência. Se mudar `frequency`, `interval`, `dayOfMonth`, `dayOfWeek` ou `startDate`, a `nextOccurrence` é recalculada.
- **Auth:** JWT Bearer
- **Path params:** `id` (string).
- **Body (`UpdateRecurringTransactionDto`):** todos os campos do `CreateRecurringTransactionDto` **opcionais** (parcial).
- **Response (200):** objeto `RecurringTransaction` atualizado (com `account` e `category`).
- **Erros:** `403` não pertence ao usuário · `404` não encontrada · `400` validação.

---

### `DELETE /api/v1/recurring-transactions/:id`
Remove a recorrência (as transações já geradas permanecem).
- **Auth:** JWT Bearer
- **Path params:** `id` (string).
- **Response (200):**
```jsonc
{ "message": "Transação recorrente deletada com sucesso" }
```
- **Erros:** `403` não pertence ao usuário · `404` não encontrada.

---

### `POST /api/v1/recurring-transactions/:id/toggle-active`
Inverte o estado `isActive` da recorrência (pausa/retoma a geração automática).
- **Auth:** JWT Bearer
- **Path params:** `id` (string).
- **Response (200):**
```jsonc
{
  "message": "Transação recorrente ativada",  // ou "... desativada"
  "isActive": true
}
```
- **Erros:** `403` não pertence ao usuário · `404` não encontrada.

---

### `POST /api/v1/recurring-transactions/:id/process-now`
Gera imediatamente uma transação a partir da recorrência (`source = RECURRING`), atualiza saldo e avança `nextOccurrence`. Exige que a recorrência esteja ativa.
- **Auth:** JWT Bearer
- **Path params:** `id` (string).
- **Response (200):**
```jsonc
{
  "message": "Transação gerada com sucesso",
  "transaction": { /* Transaction criada, source=RECURRING, com account e category */ }
}
```
- **Erros:** `400` recorrência inativa · `403` não pertence ao usuário · `404` não encontrada.
