# Transações

Convenções globais: ver [README](./README.md).

Lançamentos financeiros do usuário. Suportam criação manual, OCR de comprovante, recorrência e importação. A listagem usa **paginação cursor-based** (envelope `{ items, nextCursor, hasMore }`). Todas as rotas exigem **JWT Bearer** e operam apenas sobre transações do próprio usuário.

> O `amount` é sempre **positivo** (`Min 0.01`); o sinal financeiro vem de `type` (`INCOME` soma / `EXPENSE` subtrai do saldo da conta). Criar/alterar/excluir transação atualiza o `currentBalance` da conta e emite eventos WebSocket (`transaction.created/updated/deleted`, `balance.updated`).

---

### `POST /api/v1/transactions`
Cria uma transação (manual por padrão). Detecta marca pela descrição e, se `categoryId` não for informado, tenta categorizar via IA (aplica a sugestão se confiança ≥ 0.7 e o tipo da categoria casar).
- **Auth:** JWT Bearer
- **Rate limit:** 60 / min (`@Throttle medium`)
- **Body (`CreateTransactionDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `accountId` | string | Sim | não-vazio; conta deve existir e ser do usuário | `"uuid-da-conta"` |
| `categoryId` | string | Não | se informada: categoria deve existir e ter `type` igual ao da transação | `"uuid-da-categoria"` |
| `type` | enum `TransactionType` | Sim | `INCOME` \| `EXPENSE` | `"EXPENSE"` |
| `amount` | number | Sim | ≥ 0.01 | `150.5` |
| `description` | string | Sim | máx. 500; sanitizado | `"Almoço no restaurante"` |
| `merchant` | string | Não | sanitizado | `"Restaurante Bom Sabor"` |
| `date` | string (ISO date) | Não | ISO 8601; default = agora | `"2025-11-28"` |
| `isRecurring` | boolean | Não | — | `false` |
| `recurrencePattern` | string | Não | — | `"MONTHLY"` |
| `tags` | string[] | Não | array de strings | `["alimentação","restaurante"]` |
| `notes` | string | Não | sanitizado | `"Reunião com cliente"` |
| `source` | enum `TransactionSource` | Não | default `MANUAL` | `"MANUAL"` |
| `receiptImageUrl` | string | Não | URL do comprovante no storage (OCR) | `"https://.../receipt.jpg"` |
| `receiptRawText` | string | Não | texto bruto extraído do comprovante (OCR) | `"CUPOM FISCAL SAT ..."` |
| `receiptItems` | `ReceiptItemDto[]` | Não | itens do cupom (OCR); ver shape abaixo | — |

**`ReceiptItemDto`:** `name: string` · `quantity: number` · `unitPrice: number` · `total: number`.

- **Response (201):** objeto `Transaction` Prisma com relações incluídas:
```jsonc
{
  "id": "uuid",
  "userId": "uuid",
  "accountId": "uuid",
  "categoryId": "uuid",        // pode vir preenchido pela IA
  "brandId": "uuid",           // detectada pela descrição (ou null)
  "type": "EXPENSE",
  "amount": 150.5,             // número
  "description": "Almoço no restaurante",
  "merchant": "Restaurante Bom Sabor",
  "date": "2025-11-28T00:00:00.000Z",
  "isRecurring": false,
  "recurrencePattern": "MONTHLY",
  "tags": ["alimentação"],
  "notes": "Reunião com cliente",
  "source": "MANUAL",
  "status": "COMPLETED",       // sempre COMPLETED na criação
  "receiptImageUrl": null,
  "receiptRawText": null,
  "receiptItems": null,
  "aiCategorized": false,      // true se a categoria veio da IA (confiança ≥ 0.7)
  "aiConfidence": null,        // número quando aiCategorized
  "createdAt": "2025-11-28T12:00:00.000Z",
  "updatedAt": "2025-11-28T12:00:00.000Z",
  "category": { "id": "uuid", "name": "Alimentação", "color": "#...", "icon": "...", "type": "EXPENSE", /* ... */ },
  "account":  { "id": "uuid", "name": "Carteira", "type": "CHECKING", /* ... */ },
  "brand":    { "id": "uuid", "name": "...", "logoUrl": "...", "slug": "..." } // ou null
}
```
- **Erros:** `400` validação / tipo de categoria incompatível com o da transação · `403` conta não pertence ao usuário · `404` conta ou categoria não encontrada · `429` limite excedido.

---

### `GET /api/v1/transactions`
Lista transações do usuário com filtros e paginação cursor (mais recentes primeiro, `date desc`).
- **Auth:** JWT Bearer
- **Query (`FilterTransactionDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `cursor` | string | Não | id do último item da página anterior | `"uuid-do-ultimo-item"` |
| `take` | number | Não | inteiro 1–100, default 50 | `50` |
| `type` | enum `TransactionType` | Não | `INCOME` \| `EXPENSE` | `"EXPENSE"` |
| `categoryId` | string (UUID) | Não | UUID | `"uuid-da-categoria"` |
| `accountId` | string (UUID) | Não | UUID | `"uuid-da-conta"` |
| `status` | enum `TransactionStatus` | Não | `PENDING`\|`COMPLETED`\|`CANCELLED` | `"COMPLETED"` |
| `startDate` | string (ISO date) | Não | ISO 8601 (filtra `date >=`) | `"2024-01-01"` |
| `endDate` | string (ISO date) | Não | ISO 8601 (filtra `date <=`) | `"2024-12-31"` |
| `search` | string | Não | busca em `description` ou `merchant` (case-insensitive) | `"mercado"` |

- **Response (200):** envelope cursor; cada item é uma projeção parcial (não traz todos os campos):
```jsonc
{
  "items": [
    {
      "id": "uuid",
      "amount": 89.5,            // número
      "description": "Compra mercado",
      "merchant": "Extra",
      "brand": { "id": "uuid", "name": "Extra", "logoUrl": "...", "slug": "extra" }, // ou null
      "date": "2025-11-28T00:00:00.000Z",
      "type": "EXPENSE",
      "status": "COMPLETED",
      "tags": ["mercado"],
      "notes": null,
      "createdAt": "2025-11-28T12:00:00.000Z",
      "category": { "id": "uuid", "name": "Alimentação", "color": "#...", "icon": "...", "type": "EXPENSE" }, // ou null
      "account":  { "id": "uuid", "name": "Carteira", "type": "CHECKING", "color": "#..." }
    }
  ],
  "nextCursor": "uuid-ou-null",  // reenviar como cursor para a próxima página
  "hasMore": true
}
```
- **Erros:** `400` filtro inválido (ex.: `categoryId`/`accountId` não-UUID).

---

### `GET /api/v1/transactions/stats/monthly`
Estatísticas agregadas de um mês (somente status `COMPLETED`).
- **Auth:** JWT Bearer
- **Query:**

| Campo | Tipo | Obrigatório | Exemplo |
|-------|------|-------------|---------|
| `month` | string | Sim | `"2025-11-01"` (aceita `YYYY-MM-DD` ou ISO completo; usa mês/ano em UTC) |

- **Response (200):**
```jsonc
{
  "period": "2025-11-01",
  "income": 5000,
  "expenses": 3200,
  "balance": 1800,             // income - expenses
  "transactionCount": 42,
  "categoryBreakdown": [       // agrupado por nome de categoria
    { "name": "Alimentação", "color": "#...", "icon": "...", "total": 800, "count": 12 }
  ],
  "recentTransactions": [ /* até 10 Transaction (com category) */ ]
}
```

---

### `GET /api/v1/transactions/stats/category/:categoryId`
Estatísticas de uma categoria (somente status `COMPLETED`), opcionalmente num intervalo de datas.
- **Auth:** JWT Bearer
- **Path params:** `categoryId` (string).
- **Query:**

| Campo | Tipo | Obrigatório | Exemplo |
|-------|------|-------------|---------|
| `startDate` | string (ISO date) | Não | `"2024-01-01"` |
| `endDate` | string (ISO date) | Não | `"2024-12-31"` |

- **Response (200):**
```jsonc
{
  "categoryId": "uuid",
  "total": 1200,
  "average": 100,             // total / count (0 se não houver transações)
  "count": 12,
  "transactions": [ /* até 20 Transaction, date desc */ ]
}
```

---

### `GET /api/v1/transactions/:id`
Busca uma transação por ID (com `category`, `account`, `brand`).
- **Auth:** JWT Bearer
- **Path params:** `id` (string).
- **Response (200):** objeto `Transaction` completo (mesmo shape do `POST`, com relações incluídas).
- **Erros:** `403` não pertence ao usuário · `404` transação não encontrada.

---

### `PATCH /api/v1/transactions/:id`
Atualiza uma transação. Se `amount` ou `type` mudarem, o saldo da conta é revertido e recalculado.
- **Auth:** JWT Bearer
- **Path params:** `id` (string).
- **Body (`UpdateTransactionDto`):** todos os campos do `CreateTransactionDto` **opcionais** (parcial), mais:

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `status` | enum `TransactionStatus` | Não | `PENDING`\|`COMPLETED`\|`CANCELLED` | `"COMPLETED"` |

- **Response (200):** objeto `Transaction` atualizado (inclui `category` e `account`; **não** inclui `brand` no update).
- **Erros:** `403` não pertence ao usuário · `404` transação não encontrada · `400` validação.

---

### `DELETE /api/v1/transactions/:id`
Remove a transação e reverte seu efeito no saldo da conta.
- **Auth:** JWT Bearer
- **Path params:** `id` (string).
- **Response (200):**
```jsonc
{ "message": "Transação deletada com sucesso" }
```
- **Erros:** `403` não pertence ao usuário · `404` transação não encontrada.

---

### `POST /api/v1/transactions/:id/correct-category`
Corrige a categoria de uma transação e, se a categoria original veio da IA, registra feedback para melhorar o modelo. Marca a transação como `aiCategorized: false`.
- **Auth:** JWT Bearer
- **Path params:** `id` (string).
- **Body (`CorrectCategoryDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `correctedCategoryId` | string | Sim | categoria deve existir e ter `type` igual ao da transação | `"uuid-123"` |

- **Response (201):**
```jsonc
{
  "message": "Categoria corrigida com sucesso",
  "transaction": { /* Transaction atualizada, com category e account */ },
  "feedbackSaved": true        // true só se a transação era aiCategorized
}
```
- **Erros:** `400` tipo da categoria corrigida incompatível com o da transação · `403` não pertence ao usuário · `404` transação ou categoria corrigida não encontrada.

---

### `POST /api/v1/transactions/from-receipt`
**OCR (preview).** Recebe a imagem de um comprovante/cupom, extrai os dados via Gemini Vision e retorna um preview — **NÃO salva** a transação. A imagem é enviada ao storage (best-effort).
- **Auth:** JWT Bearer
- **Rate limit:** 10 / min (`@Throttle medium`; OCR é caro)
- **Content-Type:** `multipart/form-data`
- **Body (multipart):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `image` | file (binary) | Sim | JPG, PNG, WEBP, HEIC ou PDF; máx. 10MB | (arquivo) |

- **Response (200) (`ReceiptAnalysisResponseDto`):**
```jsonc
{
  "preview": {
    "description": "Supermercado Extra",   // ou null
    "amount": 89.5,                         // ou null
    "type": "EXPENSE",                      // EXPENSE | INCOME
    "date": "2026-02-25",                   // ou null
    "merchant": "Extra Hipermercado LTDA",  // ou null
    "categoryId": "uuid-da-categoria",      // ou null
    "categoryName": "Alimentação",          // ou null
    "confidence": 0.94,                     // 0.0 a 1.0
    "items": [
      { "name": "Leite Integral 1L", "quantity": 2, "unitPrice": 5.99, "total": 11.98 }
    ],
    "rawText": "CUPOM FISCAL SAT ...",      // ou null
    "receiptImageUrl": "https://.../receipt.jpg"  // anexado ao preview; null se o upload falhou
  },
  "aiUsed": "gemini-2.5-flash",
  "processingMs": 1842
}
```
- **Erros:** `400` arquivo inválido (formato/tamanho — `validateReceiptFile`) · `429` limite excedido.

---

### `POST /api/v1/transactions/from-receipt/confirm`
**OCR (confirmação).** Persiste o preview (possivelmente editado pelo usuário) como transação, forçando `source = OCR`. Reaproveita o fluxo de `create` (detecção de marca, categorização IA, atualização de saldo).
- **Auth:** JWT Bearer
- **Rate limit:** 60 / min (`@Throttle medium`)
- **Body (`CreateTransactionDto`):** mesmo DTO do `POST /transactions` (preencha os campos `receiptImageUrl`, `receiptRawText`, `receiptItems` vindos do preview). Qualquer `source` enviado é **sobrescrito** para `OCR`.
- **Response (201):** objeto `Transaction` (mesmo shape do `POST /transactions`), com `source: "OCR"`.
- **Erros:** iguais ao `POST /transactions` (`400` / `403` / `404` / `429`).
