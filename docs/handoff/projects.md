# Projetos (Planejamento de Despesas)

Convenções globais: ver [README](./README.md).

Projetos financeiros para organizar despesas complexas. A hierarquia é **Projeto → Itens → Cotações**:
cada item recebe cotações de fornecedores, uma é **selecionada**, e ao **converter** vira uma
transação real (debita a conta). Todos os endpoints exigem **JWT Bearer**.

**Enums relevantes:**
- `ProjectStatus`: `PLANNING` · `IN_PROGRESS` · `COMPLETED` · `CANCELLED`
- `ProjectItemStatus`: `PENDING` · `QUOTED` · `PURCHASED` · `CANCELLED`
- `QuoteStatus`: `PENDING` · `SELECTED` · `REJECTED` · `CONVERTED`

**Transições automáticas de status do item:**
- Primeira cotação adicionada: `PENDING → QUOTED`.
- Última cotação removida: volta para `PENDING`.
- Conversão: `→ PURCHASED` (não reversível via PATCH).

**Recálculo do status do projeto (`syncProjectStatus`, roda após remover item e após converter):**
- Sem itens não-cancelados → `PLANNING`.
- Todos os itens não-cancelados `PURCHASED` → `COMPLETED`.
- Ao menos 1 `PURCHASED` (mas nem todos) → `IN_PROGRESS`.
- Caso contrário → `PLANNING`.

> Segurança: posse é validada em toda a cadeia; recurso inexistente ou de outro usuário retorna
> **`404`** (nunca revela existência).

---

## Projetos

### `POST /api/v1/projects`
Cria um novo projeto (status inicial `PLANNING`).
- **Auth:** JWT Bearer
- **Body (`CreateProjectDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `name` | string | sim | sanitizado; 2–100 chars | `"Arrumar Carro"` |
| `description` | string | não | sanitizado; ≤ 500 chars | `"Revisão completa"` |
| `totalBudget` | number | não | `>= 0.01`; máx 2 casas decimais | `1500.0` |
| `deadline` | string (date) | não | ISO date | `"2026-03-15"` |
| `color` | string | não | hex color; default `#6366F1` | `"#6366F1"` |
| `icon` | string | não | ≤ 50 chars | `"car"` |

- **Response (201):** projeto criado com `items: []` e `_count.items`.
```jsonc
{
  "id": "uuid", "userId": "uuid", "name": "Arrumar Carro", "description": "...",
  "status": "PLANNING", "totalBudget": 1500, "deadline": "2026-03-15T00:00:00.000Z",
  "color": "#6366F1", "icon": "car", "createdAt": "...", "updatedAt": "...",
  "_count": { "items": 0 }, "items": []
}
```

---

### `GET /api/v1/projects`
Lista os projetos do usuário (com contagem de itens).
- **Auth:** JWT Bearer
- **Query:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `status` | enum `ProjectStatus` | não | Filtra por status |

- **Response (200):** array (ordenado por `status asc`, `createdAt desc`); cada item tem os campos do projeto + `_count.items` (sem `items`).

---

### `GET /api/v1/projects/:id`
Detalhe do projeto, com todos os itens e suas cotações.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do projeto.
- **Response (200):**
```jsonc
{
  "id": "uuid", "name": "Arrumar Carro", "status": "IN_PROGRESS", "totalBudget": 1500,
  "_count": { "items": 2 },
  "items": [
    {
      "id": "uuid", "name": "Bateria nova", "description": "...", "quantity": 1,
      "status": "QUOTED", "priority": 2, "transactionId": null,
      "createdAt": "...", "updatedAt": "...",
      "quotes": [
        { "id": "uuid", "supplierName": "AutoPeças", "price": 450, "additionalCosts": 30,
          "notes": "...", "status": "SELECTED", "createdAt": "...", "updatedAt": "..." }
      ]
    }
  ]
}
```
> Itens ordenados por `priority asc`, `createdAt asc`; cotações por `createdAt asc`.
- **Erros:** `404` projeto não encontrado / de outro usuário.

---

### `GET /api/v1/projects/:id/summary`
Dashboard do projeto: estatísticas de orçado vs. gasto, economia vs. cotações rejeitadas e progresso.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do projeto.
- **Response (200):**
```jsonc
{
  "project": {
    "id": "uuid", "name": "Arrumar Carro", "description": "...", "status": "IN_PROGRESS",
    "deadline": "...", "color": "#6366F1", "icon": "car",
    "totalBudget": 1500,        // ou null
    "createdAt": "...", "updatedAt": "..."
  },
  "stats": {
    "totalItems": 3,
    "purchasedItems": 1,
    "pendingItems": 2,
    "cancelledItems": 0,
    "totalBudgeted": 480,       // soma (price+additionalCosts) das cotações SELECTED/CONVERTED
    "totalSpent": 480,          // idem, só dos itens já PURCHASED
    "estimatedRemaining": 0,    // totalBudgeted - totalSpent
    "progressPercent": 33,      // (purchased + cancelled) / totalItems * 100
    "savingsVsRejected": 70,    // economia: rejeitadas - convertida (por item comprado, >= 0)
    "budgetVariance": 1020      // totalBudget - totalBudgeted (null se sem totalBudget)
  },
  "items": [
    {
      "id": "uuid", "name": "Bateria nova", "status": "PURCHASED", "transactionId": "uuid",
      "quotes": [
        { "id": "...", "supplierName": "AutoPeças", "price": 450, "additionalCosts": 30, "total": 480, "status": "CONVERTED" }
      ]
    }
  ]
}
```
- **Erros:** `404` projeto não encontrado.

---

### `PATCH /api/v1/projects/:id`
Atualiza um projeto.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do projeto.
- **Body (`UpdateProjectDto`):** campos de `CreateProjectDto` (opcionais) + `status` (enum `ProjectStatus`). `deadline: null` limpa o prazo.
- **Response (200):** projeto atualizado (com `items` e `_count.items`).
- **Erros:** `404` não encontrado.

---

### `DELETE /api/v1/projects/:id`
Remove o projeto e, em cascata, itens e cotações. Transações já geradas são **preservadas**.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do projeto.
- **Response (200):**
```jsonc
{ "message": "Projeto removido com sucesso" }
```
- **Erros:** `404` não encontrado.

---

## Itens do projeto

### `POST /api/v1/projects/:id/items`
Adiciona um item ao projeto (status inicial `PENDING`).
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do projeto.
- **Body (`CreateProjectItemDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `name` | string | sim | sanitizado; 2–150 chars | `"Bateria nova"` |
| `description` | string | não | sanitizado; ≤ 500 chars | `"Bateria 60Ah"` |
| `quantity` | int | não | `1`–`9999` (default `1`) | `1` |
| `priority` | int | não | `1`–`5` (1=urgente, default `3`) | `2` |

- **Response (201):** item criado (shape `ITEM_SELECT`, com `quotes: []`).
- **Erros:** `404` projeto não encontrado.

---

### `PATCH /api/v1/projects/:id/items/:itemId`
Atualiza um item. **Não** permite setar `status: PURCHASED` (use `/convert`); esse valor é ignorado.
- **Auth:** JWT Bearer
- **Path params:** `id` — projeto · `itemId` — item.
- **Body (`UpdateProjectItemDto`):** campos de `CreateProjectItemDto` (opcionais) + `status` (enum `ProjectItemStatus`, exceto `PURCHASED`).
- **Response (200):** item atualizado.
- **Erros:** `404` item não encontrado.

---

### `DELETE /api/v1/projects/:id/items/:itemId`
Remove um item (e suas cotações). Recalcula o status do projeto.
- **Auth:** JWT Bearer
- **Path params:** `id` — projeto · `itemId` — item.
- **Response (200):**
```jsonc
{ "message": "Item removido com sucesso" }
```
- **Erros:** `404` item não encontrado.

---

## Cotações

Toda cotação retornada inclui campos calculados `price`/`additionalCosts` como número e `total`
(`price + additionalCosts`, 2 casas).

### `POST /api/v1/projects/:id/items/:itemId/quotes`
Adiciona uma cotação de fornecedor ao item (status `PENDING`). A primeira cotação muda o item para `QUOTED`.
- **Auth:** JWT Bearer
- **Path params:** `id` — projeto · `itemId` — item.
- **Body (`CreateQuoteDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `supplierName` | string | sim | sanitizado; 2–150 chars | `"AutoPeças Centro"` |
| `price` | number | sim | `>= 0.01`; máx 2 casas | `450.0` |
| `additionalCosts` | number | não | `>= 0`; máx 2 casas (default `0`) | `30.0` |
| `notes` | string | não | sanitizado; ≤ 500 chars | `"À vista, 5% off"` |

- **Response (201):**
```jsonc
{ "id": "uuid", "supplierName": "AutoPeças Centro", "price": 450, "additionalCosts": 30,
  "notes": "...", "status": "PENDING", "createdAt": "...", "updatedAt": "...", "total": 480 }
```
- **Erros:** `409` item já comprado (`PURCHASED`) · `404` item não encontrado.

---

### `PATCH /api/v1/projects/:id/items/:itemId/quotes/:quoteId`
Atualiza uma cotação.
- **Auth:** JWT Bearer
- **Path params:** `id` · `itemId` · `quoteId`.
- **Body (`UpdateQuoteDto`):** campos de `CreateQuoteDto`, todos **opcionais** (`PartialType`).
- **Response (200):** cotação atualizada (com `total`).
- **Erros:** `409` cotação já `CONVERTED` (não editável) · `404` cotação não encontrada.

---

### `DELETE /api/v1/projects/:id/items/:itemId/quotes/:quoteId`
Remove uma cotação. Se era a última do item, o item volta para `PENDING`.
- **Auth:** JWT Bearer
- **Path params:** `id` · `itemId` · `quoteId`.
- **Response (200):**
```jsonc
{ "message": "Cotação removida com sucesso" }
```
- **Erros:** `409` cotação já `CONVERTED` · `404` não encontrada.

---

### `PATCH /api/v1/projects/:id/items/:itemId/quotes/:quoteId/select`
Marca a cotação como `SELECTED` e **desmarca** as demais do mesmo item (voltam a `PENDING`), atomicamente.
- **Auth:** JWT Bearer
- **Path params:** `id` · `itemId` · `quoteId`.
- **Response (200):** cotação selecionada (com `total`, `status: "SELECTED"`).
- **Erros:** `409` cotação já `CONVERTED` · `404` não encontrada.

---

### `PATCH /api/v1/projects/:id/items/:itemId/quotes/:quoteId/reject`
Marca a cotação como `REJECTED` (descartada).
- **Auth:** JWT Bearer
- **Path params:** `id` · `itemId` · `quoteId`.
- **Response (200):** cotação rejeitada (com `total`, `status: "REJECTED"`).
- **Erros:** `409` cotação já `CONVERTED` · `404` não encontrada.

---

## Conversão (cotação → transação)

### `POST /api/v1/projects/:id/items/:itemId/convert`
Converte a cotação `SELECTED` do item em uma transação financeira real, em **transação de banco atômica**.
- **Auth:** JWT Bearer
- **Path params:** `id` — projeto · `itemId` — item a comprar.
- **Body (`ConvertQuoteDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `accountId` | string (uuid) | sim | UUID; conta deve existir e ser do usuário | `"uuid-da-conta"` |
| `categoryId` | string (uuid) | não | UUID; categoria deve existir e ser do tipo `EXPENSE` | `"uuid-da-categoria"` |
| `date` | string (date) | não | ISO date (default: hoje) | `"2026-02-22"` |
| `notes` | string | não | sanitizado; ≤ 500 chars | `"Compra via projeto"` |

**Fluxo executado:**
1. Valida que o item **não** está `PURCHASED` (evita duplicidade) → senão `409`.
2. Localiza a cotação com status `SELECTED` → se nenhuma, `422`.
3. Valida conta (existe + dono) e categoria (se enviada, deve ser `EXPENSE`).
4. Cria uma **Transaction** `EXPENSE`, `COMPLETED`, `source: MANUAL`, `amount = price + additionalCosts`, `description: "[Projeto] <item>"`, `tags: ["projeto"]`.
5. **Debita** o saldo da conta (`currentBalance -= total`).
6. Cotação → `CONVERTED`; item → `PURCHASED` (guardando `transactionId`).
7. Recalcula o status do projeto (`syncProjectStatus`).
8. Emite evento WebSocket `balance.updated` e invalida cache do usuário.

- **Response (201):**
```jsonc
{
  "transaction": {
    "id": "uuid", "userId": "uuid", "accountId": "uuid", "categoryId": "uuid-ou-null",
    "type": "EXPENSE", "amount": 480, "description": "[Projeto] Bateria nova",
    "notes": "...", "date": "...", "status": "COMPLETED", "source": "MANUAL", "tags": ["projeto"],
    "category": { "id": "...", "name": "...", "color": "..." },   // null se sem categoria
    "account": { "id": "...", "name": "...", "type": "..." }
  },
  "item": { /* item atualizado: status PURCHASED, transactionId preenchido */ },
  "projectStatus": "IN_PROGRESS",   // novo status do projeto após recálculo
  "totalConverted": 480
}
```
- **Erros:**
  - `409` item já comprado anteriormente.
  - `422` nenhuma cotação `SELECTED` para o item (selecione antes via `.../select`); ou categoria não é `EXPENSE`.
  - `404` item / conta / categoria não encontrada.
  - `403` conta pertence a outro usuário.
