# Categorias

Convenções globais: ver [README](./README.md).

Categorias de transação — categorias do **sistema** (`isSystem: true`, `userId: null`) e do **usuário**, com hierarquia (pai/filhos) e estatísticas de uso.

> Todas as rotas exigem **JWT Bearer** (guard aplicado no controller inteiro). Categorias do sistema são visíveis a todos, mas **não podem ser editadas nem deletadas**. Categorias com `userId` de outro usuário → `403`.

O objeto **Category** (model Prisma) tem o shape:
```jsonc
{
  "id": "uuid",
  "userId": "uuid",                   // null em categorias do sistema
  "name": "Academia",
  "type": "EXPENSE",                  // EXPENSE | INCOME | TRANSFER
  "parentId": "uuid",                 // pode ser null
  "color": "#EF4444",
  "icon": "dumbbell",                 // pode ser null
  "isSystem": false,
  "isEssential": true,
  "budgetAllocated": null,            // Decimal | null → número no JSON
  "createdAt": "2026-06-27T12:00:00.000Z"
}
```
As respostas de criação/listagem/detalhe incluem relações: `parent`, `children` e `_count.transactions` (listagem e detalhe; criação inclui apenas `parent`).

---

### `POST /api/v1/categories`
Cria uma categoria personalizada (`isSystem: false`). Valida a categoria pai, se informada.
- **Auth:** JWT Bearer
- **Body (`CreateCategoryDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `name` | string | sim | 2–100 caracteres; sanitizado (`@Sanitize`) | `"Academia"` |
| `type` | enum `CategoryType` | sim | `EXPENSE` \| `INCOME` \| `TRANSFER` | `"EXPENSE"` |
| `color` | string | não | hex válido (`IsHexColor`); default por tipo se omitido (EXPENSE `#EF4444`, INCOME `#10B981`, TRANSFER `#6366F1`) | `"#EF4444"` |
| `icon` | string | não | — | `"dumbbell"` |
| `parentId` | string | não | id de categoria pai (do usuário ou do sistema) | `"uuid-categoria-pai"` |
| `isEssential` | boolean | não | `true` \| `false` (default `true`) | `true` |

- **Response (201):** objeto **Category** com `parent` incluído.
- **Erros:** `400` (validação; ou tipo do pai incompatível com o da nova categoria), `401`, `403` (categoria pai pertence a outro usuário), `404` (categoria pai não encontrada).

---

### `GET /api/v1/categories`
Lista todas as categorias visíveis ao usuário (do usuário + do sistema). Sistema vem primeiro, depois ordem alfabética.
- **Auth:** JWT Bearer
- **Query:**

| Campo | Tipo | Obrigatório | Validações / Default |
|-------|------|-------------|----------------------|
| `type` | enum `CategoryType` | não | filtra por `EXPENSE` \| `INCOME` \| `TRANSFER` |

- **Response (200):** array de objetos **Category**, cada um com `parent`, `children` e `_count.transactions`.
- **Erros:** `401`.

---

### `GET /api/v1/categories/:id/stats`
Estatísticas de uso da categoria (somente transações `COMPLETED`), com as 10 transações mais recentes.
- **Auth:** JWT Bearer
- **Path params:**

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|-----------|
| `id` | string | sim | id da categoria |

- **Query:**

| Campo | Tipo | Obrigatório | Validações / Default |
|-------|------|-------------|----------------------|
| `startDate` | string (data) | não | filtra `date >=` (parseado com `new Date(...)`) — ex.: `2025-11-01` |
| `endDate` | string (data) | não | filtra `date <=` — ex.: `2025-11-30` |

- **Response (200):**
```jsonc
{
  "category": { /* objeto Category com parent, children, _count.transactions */ },
  "total": 350.0,                  // soma de amount das COMPLETED no período
  "count": 7,                      // número de transações
  "average": 50.0,                 // total / count (0 se count=0)
  "recentTransactions": [ /* até 10 transações Prisma cruas, date desc */ ]
}
```
- **Erros:** `401`, `403` (categoria de outro usuário), `404` (categoria não encontrada).

---

### `GET /api/v1/categories/:id`
Busca uma categoria por ID.
- **Auth:** JWT Bearer
- **Path params:**

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|-----------|
| `id` | string | sim | id da categoria |

- **Response (200):** objeto **Category** com `parent`, `children` e `_count.transactions`.
- **Erros:** `401`, `403` (categoria de outro usuário), `404` (categoria não encontrada).

---

### `PATCH /api/v1/categories/:id`
Atualiza uma categoria personalizada. Categorias do sistema não podem ser editadas.
- **Auth:** JWT Bearer
- **Path params:**

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|-----------|
| `id` | string | sim | id da categoria |

- **Body (`UpdateCategoryDto`):** `PartialType(CreateCategoryDto)` — todos os campos opcionais.

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `name` | string | não | 2–100 caracteres; sanitizado | `"Academia"` |
| `type` | enum `CategoryType` | não | `EXPENSE` \| `INCOME` \| `TRANSFER` | `"EXPENSE"` |
| `color` | string | não | hex válido | `"#EF4444"` |
| `icon` | string | não | — | `"dumbbell"` |
| `parentId` | string | não | id de categoria pai; não pode ser a própria categoria; tipo deve ser compatível | `"uuid-pai"` |
| `isEssential` | boolean | não | — | `true` |

- **Response (200):** objeto **Category** atualizado com `parent` e `children`.
- **Erros:** `400` (validação; categoria não pode ser pai de si mesma; tipos incompatíveis), `401`, `403` (categoria do sistema, ou de outro usuário), `404` (categoria ou categoria pai não encontrada).

---

### `DELETE /api/v1/categories/:id`
Deleta uma categoria personalizada. Bloqueado para categorias do sistema, com transações associadas ou com subcategorias.
- **Auth:** JWT Bearer
- **Path params:**

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|-----------|
| `id` | string | sim | id da categoria |

- **Response (200):**
```jsonc
{ "message": "Categoria deletada com sucesso" }
```
- **Erros:** `400` (possui transações associadas, ou possui subcategorias), `401`, `403` (categoria do sistema, ou de outro usuário), `404` (categoria não encontrada).
