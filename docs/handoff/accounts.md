# Contas

Convenções globais: ver [README](./README.md).

Contas (carteiras) do usuário — criação, listagem, saldo total e CRUD. Valores monetários (`Decimal`) chegam como número no JSON.

> Todas as rotas exigem **JWT Bearer** (guard aplicado no controller inteiro). Cada conta pertence a um usuário; acessar conta de outro usuário → `403`.

O objeto **Account** (model Prisma) tem o shape:
```jsonc
{
  "id": "uuid",
  "userId": "uuid",
  "name": "Nubank",
  "type": "CHECKING",                 // CHECKING | SAVINGS | CREDIT_CARD | INVESTMENT
  "bankCode": "260",                  // pode ser null
  "initialBalance": 1000.0,
  "currentBalance": 1000.0,
  "currency": "BRL",
  "color": "#6366F1",
  "icon": "credit-card",              // pode ser null
  "isActive": true,
  "openBankingConnected": false,
  "openBankingConsentId": null,
  "createdAt": "2026-06-27T12:00:00.000Z",
  "updatedAt": "2026-06-27T12:00:00.000Z"
}
```

---

### `POST /api/v1/accounts`
Cria uma nova conta. `currentBalance` é inicializado igual ao `initialBalance`.
- **Auth:** JWT Bearer
- **Body (`CreateAccountDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `name` | string | sim | 2–100 caracteres | `"Nubank"` |
| `type` | enum `AccountType` | sim | `CHECKING` \| `SAVINGS` \| `CREDIT_CARD` \| `INVESTMENT` | `"CHECKING"` |
| `bankCode` | string | não | — | `"260"` |
| `initialBalance` | number | não | default `0` (também vira o `currentBalance`) | `1000.0` |
| `color` | string | não | default `"#6366F1"` se omitido | `"#6366F1"` |
| `icon` | string | não | — | `"credit-card"` |

- **Response (201):** objeto **Account** (ver shape acima).
- **Erros:** `400` (validação), `401`.

---

### `GET /api/v1/accounts`
Lista as contas do usuário, ordenadas por `createdAt` desc.
- **Auth:** JWT Bearer
- **Query:**

| Campo | Tipo | Obrigatório | Validações / Default |
|-------|------|-------------|----------------------|
| `activeOnly` | string | não | default: traz só ativas; envie `activeOnly=false` para incluir inativas |

- **Response (200):** array de objetos **Account**.
- **Erros:** `401`.

---

### `GET /api/v1/accounts/balance`
Retorna o saldo total e um resumo das contas ativas.
- **Auth:** JWT Bearer
- **Response (200):**
```jsonc
{
  "totalBalance": 4500.0,
  "accounts": [
    {
      "id": "uuid",
      "name": "Nubank",
      "type": "CHECKING",
      "balance": 1000.0,
      "color": "#6366F1",
      "icon": "credit-card"
    }
  ]
}
```
- **Erros:** `401`.

---

### `GET /api/v1/accounts/:id`
Busca uma conta por ID.
- **Auth:** JWT Bearer
- **Path params:**

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|-----------|
| `id` | string | sim | id da conta |

- **Response (200):** objeto **Account** (ver shape acima).
- **Erros:** `401`, `403` (conta de outro usuário), `404` (conta não encontrada).

---

### `PATCH /api/v1/accounts/:id`
Atualiza uma conta. Aceita qualquer subconjunto dos campos de criação + `isActive`.
- **Auth:** JWT Bearer
- **Path params:**

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|-----------|
| `id` | string | sim | id da conta |

- **Body (`UpdateAccountDto`):** `PartialType(CreateAccountDto)` — todos os campos opcionais + `isActive`.

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `name` | string | não | 2–100 caracteres | `"Nubank PJ"` |
| `type` | enum `AccountType` | não | `CHECKING` \| `SAVINGS` \| `CREDIT_CARD` \| `INVESTMENT` | `"SAVINGS"` |
| `bankCode` | string | não | — | `"260"` |
| `initialBalance` | number | não | — | `1500.0` |
| `color` | string | não | — | `"#10B981"` |
| `icon` | string | não | — | `"wallet"` |
| `isActive` | boolean | não | — | `true` |

- **Response (200):** objeto **Account** atualizado.
- **Erros:** `400` (validação), `401`, `403` (conta de outro usuário), `404` (conta não encontrada).

---

### `DELETE /api/v1/accounts/:id`
Desativa a conta (**soft delete** — define `isActive: false`, não remove do banco).
- **Auth:** JWT Bearer
- **Path params:**

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|-----------|
| `id` | string | sim | id da conta |

- **Response (200):** objeto **Account** atualizado (`isActive: false`).
- **Erros:** `401`, `403` (conta de outro usuário), `404` (conta não encontrada).
