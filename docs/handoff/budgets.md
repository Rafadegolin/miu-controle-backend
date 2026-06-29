# Orçamentos

Convenções globais: ver [README](./README.md).

Orçamentos por categoria, com período (`MONTHLY` / `WEEKLY` / `YEARLY`) e alerta percentual.
Todo orçamento retornado nas leituras vem com campos **calculados em tempo real**:
`spent` (soma das transações `EXPENSE` + `COMPLETED` da categoria no período), `remaining`
(`amount - spent`), `percentage` (`spent/amount*100`, arredondado a 2 casas) e `status`.

**`status` (string calculada):**

| Valor | Regra |
|-------|-------|
| `OK` | `percentage < alertPercentage` |
| `WARNING` | `alertPercentage <= percentage < 100` |
| `EXCEEDED` | `percentage >= 100` |

> Atenção: o `status` do `GET /budgets` / `GET /budgets/:id` usa os valores em **maiúsculas**
> acima. Já o bloco `budgets` do `GET /dashboard/home` usa `ok` / `warning` / `exceeded`
> (minúsculas) — são views diferentes.

---

### `POST /api/v1/budgets`
Cria um novo orçamento para uma categoria.
- **Auth:** JWT Bearer
- **Body (`CreateBudgetDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `categoryId` | string | sim | — | `"cat-alimentacao"` |
| `amount` | number | sim | `>= 0.01` | `1500.0` |
| `period` | enum `BudgetPeriod` | sim | `MONTHLY` \| `WEEKLY` \| `YEARLY` | `"MONTHLY"` |
| `startDate` | string (date) | sim | ISO date (`YYYY-MM-DD`) | `"2025-11-01"` |
| `endDate` | string (date) | não | ISO date; não pode ser anterior a `startDate` | `"2025-11-30"` |
| `alertPercentage` | int | não | `1`–`100` (default `80`) | `80` |

- **Response (201):** objeto Budget criado (sem `spent`/`status` — só nas leituras).
```jsonc
{
  "id": "uuid",
  "userId": "uuid",
  "categoryId": "cat-alimentacao",
  "amount": 1500,
  "period": "MONTHLY",
  "startDate": "2025-11-01T00:00:00.000Z",
  "endDate": "2025-11-30T00:00:00.000Z",
  "alertPercentage": 80,
  "createdAt": "2025-11-01T12:00:00.000Z",
  "updatedAt": "2025-11-01T12:00:00.000Z",
  "category": { "id": "cat-alimentacao", "name": "Alimentação", "type": "EXPENSE", "color": "#EF4444", "icon": "🍔" }
}
```
- **Erros:**
  - `404` Categoria não encontrada.
  - `403` Categoria pertence a outro usuário.
  - `400` `endDate` anterior a `startDate`; validação de DTO.
  - `409` Já existe orçamento para essa categoria, período e `startDate`.

---

### `GET /api/v1/budgets`
Lista todos os orçamentos do usuário, cada um com campos calculados.
- **Auth:** JWT Bearer
- **Query:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `period` | enum `BudgetPeriod` | não | Filtra por período |

- **Response (200):** array de orçamentos (ordenado por `startDate desc`):
```jsonc
[
  {
    "id": "uuid",
    "userId": "uuid",
    "categoryId": "cat-alimentacao",
    "amount": 1500,
    "period": "MONTHLY",
    "startDate": "2025-11-01T00:00:00.000Z",
    "endDate": "2025-11-30T00:00:00.000Z",
    "alertPercentage": 80,
    "createdAt": "...",
    "updatedAt": "...",
    "category": { "id": "...", "name": "Alimentação", "type": "EXPENSE", "color": "#EF4444", "icon": "🍔" },
    "spent": 1200,        // calculado
    "remaining": 300,     // amount - spent
    "percentage": 80,     // spent/amount*100, 2 casas
    "status": "WARNING"   // OK | WARNING | EXCEEDED
  }
]
```

---

### `GET /api/v1/budgets/summary`
Resumo dos orçamentos `MONTHLY` de um mês, com totais agregados. **Cache: 10 min.**
- **Auth:** JWT Bearer
- **Query:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `month` | string (date) | não | Mês de referência (default: mês atual). Ex.: `2025-11-01` |

- **Response (200):**
```jsonc
{
  "period": "2025-11",
  "totalBudgeted": 5000,
  "totalSpent": 3200,
  "totalRemaining": 1800,
  "overallPercentage": 64,        // totalSpent/totalBudgeted*100
  "budgets": [
    {
      "id": "uuid",
      "category": { "id": "...", "name": "Alimentação", "color": "#EF4444", "icon": "🍔" },
      "budgeted": 1500,
      "spent": 1200,
      "remaining": 300,
      "percentage": 80,
      "status": "WARNING"          // OK | WARNING | EXCEEDED
    }
  ]
}
```
> `overallPercentage` será `NaN`/`Infinity` se não houver orçamentos no mês (`totalBudgeted = 0`). _(inferido — validar)_

---

### `GET /api/v1/budgets/:id`
Busca um orçamento por ID, com campos calculados e as últimas transações da categoria no período.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do orçamento.
- **Response (200):** mesmo shape de um item de `GET /budgets`, acrescido de `transactions` (até 20, `COMPLETED`, da categoria, `date desc`):
```jsonc
{
  "id": "uuid",
  "amount": 1500,
  "category": { "id": "...", "name": "Alimentação", "type": "EXPENSE", "color": "#EF4444", "icon": "🍔" },
  "spent": 1200,
  "remaining": 300,
  "percentage": 80,
  "status": "WARNING",
  "transactions": [ /* até 20 transações COMPLETED da categoria no período */ ]
}
```
- **Erros:** `404` não encontrado · `403` pertence a outro usuário.

---

### `PATCH /api/v1/budgets/:id`
Atualiza um orçamento. Campos parciais.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do orçamento.
- **Body (`UpdateBudgetDto`):** todos os campos de `CreateBudgetDto`, todos **opcionais** (`PartialType`).

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|------------|
| `categoryId` | string | não | — |
| `amount` | number | não | `>= 0.01` |
| `period` | enum `BudgetPeriod` | não | `MONTHLY` \| `WEEKLY` \| `YEARLY` |
| `startDate` | string (date) | não | ISO date |
| `endDate` | string (date) | não | ISO date; não anterior a `startDate` |
| `alertPercentage` | int | não | `1`–`100` |

- **Response (200):** Budget atualizado (mesmo shape do `POST`, com `category` incluída; **sem** `spent`/`status`).
- **Erros:** `404` não encontrado / categoria inexistente · `403` sem permissão · `400` datas inválidas.

---

### `DELETE /api/v1/budgets/:id`
Remove um orçamento.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do orçamento.
- **Response (200):**
```jsonc
{ "message": "Orçamento deletado com sucesso" }
```
- **Erros:** `404` não encontrado · `403` sem permissão.
