# Dashboard, Relatórios e Exportação

Convenções globais: ver [README](./README.md).

Três domínios de leitura/agregação:
- **Dashboard** (`/dashboard/home`): payload único e completo para a tela inicial.
- **Relatórios** (`/reports/*`): análises filtráveis por período/tipo/conta/categoria.
- **Exportação** (`/export/*`): download de transações em CSV / Excel / PDF (rate-limited).

Todos os endpoints exigem **JWT Bearer**.

---

## Dashboard

### `GET /api/v1/dashboard/home`
Retorna um resumo completo da tela inicial: saldos, mês atual, ritmo de gastos, evolução patrimonial, top categorias, metas, orçamentos, recorrências, transações recentes, notificações, datas importantes e insights.
- **Auth:** JWT Bearer
- **Response (200) (`DashboardResponseDto`):**

```jsonc
{
  // ── Saldos das contas ───────────────────────────────────────────
  "accountsSummary": {
    "totalBalance": 15000.75,
    "accounts": [
      {
        "id": "uuid",
        "name": "Conta Corrente",
        "currentBalance": 5000.5,
        "type": "CHECKING",          // CHECKING | SAVINGS | CREDIT_CARD | INVESTMENT
        "currency": "BRL",
        "color": "#6366F1",
        "icon": "💳"                 // opcional
      }
    ],
    "activeAccountsCount": 3
  },

  // ── Resumo do mês atual ─────────────────────────────────────────
  "currentMonth": {
    "income": 5000.0,
    "expense": 3500.0,
    "balance": 1500.0,
    "transactionCount": 45,
    "avgDailyExpense": 116.67,
    "comparisonWithLastMonth": {
      "incomeChange": 15.5,          // % vs mês anterior
      "expenseChange": -10.2,
      "balanceChange": 35.8
    }
  },

  // ── Ritmo de gastos (mês atual) ─────────────────────────────────
  "spendingPace": {
    "data": [
      { "date": "2026-02-01", "daily": 150.5, "accumulated": 1500.75, "expected": 1200.0 }
    ],
    "avgDaily": 50.25,
    "projectedMonthTotal": 1500.0    // projeção do total do mês no ritmo atual
  },

  // ── Evolução patrimonial (últimos 6 meses) ──────────────────────
  "wealthEvolution": {
    "data": [
      { "month": "2025-09", "totalBalance": 15000.0, "change": 500.0, "changePercentage": 3.45 }
    ],
    "totalChange": 2500.0,
    "totalChangePercentage": 20.5
  },

  // ── Top categorias de gasto (com comparação) ────────────────────
  "topCategories": {
    "categories": [
      {
        "id": "uuid",
        "name": "Alimentação",
        "amount": 1500.0,
        "percentage": 35.5,          // % do total de despesas
        "changeFromLastMonth": 15.5,
        "color": "#EF4444",
        "icon": "🍽️",
        "lastMonthAmount": 1300.0
      }
    ],
    "totalExpenses": 4500.0
  },

  // ── Metas ───────────────────────────────────────────────────────
  "goals": {
    "active": [
      {
        "id": "uuid",
        "name": "Viagem para Europa",
        "targetAmount": 10000.0,
        "currentAmount": 7500.0,
        "progress": 75.0,
        "targetDate": "2025-12-31T00:00:00Z",   // opcional
        "daysRemaining": 180,                    // opcional
        "color": "#10B981",
        "icon": "✈️",                            // opcional
        "status": "ACTIVE"                       // ACTIVE | COMPLETED | CANCELLED
      }
    ],
    "nearCompletion": [ /* metas com progress > 80% (mesmo shape de GoalItem) */ ],
    "totalActiveGoals": 5
  },

  // ── Orçamentos ──────────────────────────────────────────────────
  "budgets": {
    "items": [
      {
        "id": "uuid",
        "categoryName": "Alimentação",
        "amount": 1000.0,
        "spent": 750.0,
        "percentage": 75.0,
        "status": "ok",              // ok (<80%) | warning (80-100%) | exceeded (>100%) — minúsculas aqui
        "categoryColor": "#94A3B8",
        "categoryIcon": "🍔"          // opcional
      }
    ],
    "overBudget": [ /* percentage > 100% */ ],
    "nearLimit": [ /* percentage 80-100% */ ],
    "totalBudgets": 8
  },

  // ── Recorrências dos próximos 7 dias ────────────────────────────
  "upcomingRecurring": [
    {
      "id": "uuid",
      "description": "Netflix Subscription",
      "type": "EXPENSE",             // INCOME | EXPENSE
      "amount": 49.9,
      "nextOccurrence": "2025-01-15T00:00:00Z",
      "daysUntil": 5,
      "frequency": "MONTHLY",        // DAILY | WEEKLY | MONTHLY | YEARLY
      "accountName": "Conta Corrente"
    }
  ],

  // ── Últimas 10 transações ───────────────────────────────────────
  "recentTransactions": [
    {
      "id": "uuid",
      "description": "Supermercado Extra",
      "amount": 250.5,
      "type": "EXPENSE",             // INCOME | EXPENSE | TRANSFER
      "date": "2026-02-03T10:30:00Z",
      "categoryName": "Alimentação",
      "categoryColor": "#EF4444",
      "categoryIcon": "🍽️",          // opcional
      "accountName": "Nubank",
      "status": "COMPLETED"          // PENDING | COMPLETED | CANCELLED
    }
  ],

  // ── Notificações ────────────────────────────────────────────────
  "notifications": {
    "unreadCount": 5,
    "recent": [
      {
        "id": "uuid",
        "type": "BUDGET_ALERT",      // BUDGET_ALERT | BUDGET_EXCEEDED | GOAL_ACHIEVED | GOAL_MILESTONE | BILL_DUE | SYSTEM
        "title": "Orçamento de Alimentação",
        "message": "Você já gastou 80% do orçamento deste mês",
        "read": false,
        "createdAt": "2025-01-10T10:30:00Z"
      }
    ]                                // últimas 5
  },

  // ── Datas importantes (próximos 30 dias) ────────────────────────
  "importantDates": [
    {
      "type": "recurring",           // recurring | goal | budget
      "title": "Netflix Subscription",
      "date": "2025-01-15T00:00:00Z",
      "daysUntil": 5,
      "referenceId": "uuid"
    }
  ],

  // ── Insights inteligentes ───────────────────────────────────────
  "insights": [
    {
      "type": "warning",             // warning | info | success | error
      "title": "Gastos em Alta",
      "message": "Seus gastos aumentaram 15% em relação ao mês anterior",
      "icon": "📈"
    }
  ],

  "generatedAt": "2025-01-10T12:00:00Z"
}
```
- **Erros:** `401` token inválido ou ausente.

---

## Relatórios

Todos os endpoints aceitam o mesmo filtro de query e exigem JWT Bearer. O `where` interno aplica
sempre `status: COMPLETED` às transações consideradas.

**Query (`ReportFiltersDto`) — comum a todos:**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `startDate` | string (date) | não | ISO date | `2024-01-01` |
| `endDate` | string (date) | não | ISO date | `2024-12-31` |
| `type` | enum `TransactionType` | não | `INCOME` \| `EXPENSE` | `EXPENSE` |
| `accountId` | string | não | — | `uuid-da-conta` |
| `categoryId` | string | não | — | `uuid-da-categoria` |

> **Cache:** apenas `GET /reports/dashboard` cacheia (5 min, chave por filtros). `insights` e
> `full-report` reaproveitam esse cache indiretamente (chamam `getDashboard`); os demais
> (`category-analysis`, `monthly-trend`, `account-analysis`, `top-transactions`) computam sempre fresco.

---

### `GET /api/v1/reports/dashboard`
KPIs principais do período (totais, médias, destaques). **Cache: 5 min.**
- **Auth:** JWT Bearer · **Query:** `ReportFiltersDto`
- **Response (200):**
```jsonc
{
  "summary": {
    "totalIncome": 12000, "totalExpense": 8000, "balance": 4000,
    "transactionCount": 120, "incomeCount": 30, "expenseCount": 90
  },
  "averages": {
    "avgDailyIncome": 100.5,
    "avgDailyExpense": 67.0,
    "avgTransactionValue": 166.67   // (income+expense)/count
  },
  "highlights": {
    "highestIncome": { "amount": 5000, "description": "Salário", "date": "..." },   // ou null
    "highestExpense": { "amount": 1200, "description": "Aluguel", "date": "..." }   // ou null
  },
  "period": { "startDate": "2024-01-01T...", "endDate": "2024-12-31T...", "days": 365 }
}
```
> Sem `startDate`, o período padrão começa em 1º de janeiro do ano corrente (UTC); sem `endDate`, hoje.

---

### `GET /api/v1/reports/category-analysis`
Agrupa transações por categoria, com totais, contagem, lista de transações e % do total.
- **Auth:** JWT Bearer · **Query:** `ReportFiltersDto`
- **Response (200):**
```jsonc
{
  "categories": [
    {
      "categoryId": "uuid",          // "sem-categoria" quando nula
      "categoryName": "Alimentação",
      "categoryColor": "#EF4444",
      "categoryIcon": "🍽️",
      "totalIncome": 0,
      "totalExpense": 1500,
      "count": 12,
      "transactions": [
        { "id": "...", "amount": 250, "description": "...", "date": "...", "type": "EXPENSE" }
      ],
      "total": 1500,                 // income + expense
      "percentage": 35.5             // % do grandTotal
    }
  ],
  "totalCategories": 6,
  "grandTotal": 4500
}
```

---

### `GET /api/v1/reports/monthly-trend`
Série mensal (receita/despesa/saldo) para gráfico de linha. Agrupamento por mês UTC.
- **Auth:** JWT Bearer · **Query:** `ReportFiltersDto`
- **Response (200):**
```jsonc
{
  "months": [
    { "month": "2024-01", "income": 5000, "expense": 3000, "balance": 2000, "transactionCount": 25 }
  ],
  "totalMonths": 12
}
```

---

### `GET /api/v1/reports/account-analysis`
Agrupa transações por conta bancária, com saldo atual e fluxo líquido.
- **Auth:** JWT Bearer · **Query:** `ReportFiltersDto`
- **Response (200):**
```jsonc
{
  "accounts": [
    {
      "accountId": "uuid",
      "accountName": "Nubank",
      "accountColor": "#820AD1",
      "currentBalance": 5000,
      "totalIncome": 8000,
      "totalExpense": 3000,
      "count": 40,
      "netFlow": 5000               // income - expense
    }
  ],
  "totalAccounts": 3
}
```

---

### `GET /api/v1/reports/top-transactions`
Top 10 maiores receitas e top 10 maiores despesas do período.
- **Auth:** JWT Bearer · **Query:** `ReportFiltersDto`
- **Response (200):**
```jsonc
{
  "topExpenses": [
    { "id": "uuid", "amount": 1200, "description": "Aluguel", "date": "...",
      "category": "Moradia", "account": "Nubank" }   // category = "Sem categoria" se nula
  ],
  "topIncomes": [
    { "id": "uuid", "amount": 5000, "description": "Salário", "date": "...",
      "category": "Renda", "account": "Itaú" }
  ]
}
```

---

### `GET /api/v1/reports/insights`
Insights automáticos derivados de dashboard + category-analysis + monthly-trend.
- **Auth:** JWT Bearer · **Query:** `ReportFiltersDto`
- **Response (200):** **array** de insights (quantidade variável):
```jsonc
[
  { "type": "positive", "title": "Saldo Positivo", "message": "Você economizou R$ 4000.00 neste período!", "icon": "💰" },
  { "type": "info", "title": "Maior Categoria de Gastos", "message": "Alimentação representa 35.5% ...", "icon": "🍽️" },
  { "type": "info", "title": "Média Diária", "message": "Você gasta em média R$ 67.00 por dia", "icon": "📊" },
  { "type": "warning", "title": "Gastos em Alta", "message": "Seus gastos aumentaram 12.5% ...", "icon": "📈" }
]
```
> `type` possíveis aqui: `positive` | `negative` | `info` | `warning`.

---

### `GET /api/v1/reports/full-report`
Relatório consolidado: roda todas as análises acima em paralelo.
- **Auth:** JWT Bearer · **Query:** `ReportFiltersDto`
- **Response (200):**
```jsonc
{
  "dashboard": { /* GET /reports/dashboard */ },
  "categoryAnalysis": { /* GET /reports/category-analysis */ },
  "monthlyTrend": { /* GET /reports/monthly-trend */ },
  "accountAnalysis": { /* GET /reports/account-analysis */ },
  "topTransactions": { /* GET /reports/top-transactions */ },
  "insights": [ /* GET /reports/insights */ ],
  "generatedAt": "2026-06-27T12:00:00.000Z"
}
```

---

## Exportação

Geram um arquivo de transações para **download** (header `Content-Disposition: attachment`).
Aceitam os mesmos filtros e exigem JWT Bearer. **Rate limit: 10 requisições / hora** (tier `long`)
por endpoint — exceder retorna `429`.

**Query (`ExportFiltersDto`) — comum aos três:**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `startDate` | string (date) | não | ISO date | `2024-01-01` |
| `endDate` | string (date) | não | ISO date | `2024-12-31` |
| `type` | enum `TransactionType` | não | `INCOME` \| `EXPENSE` | `EXPENSE` |
| `categoryId` | string (uuid) | não | UUID | `uuid-da-categoria` |
| `accountId` | string (uuid) | não | UUID | `uuid-da-conta` |

Nome do arquivo: `transacoes_<YYYY-MM-DD>.<ext>`.

---

### `GET /api/v1/export/csv`
Exporta transações em CSV (UTF-8 com BOM).
- **Auth:** JWT Bearer
- **Rate limit:** 10 / hora
- **Query:** `ExportFiltersDto`
- **Response (200):** corpo é o conteúdo do arquivo (não JSON).
  - `Content-Type: text/csv; charset=utf-8`
  - `Content-Disposition: attachment; filename="transacoes_2026-06-27.csv"`
- **Erros:** `429` limite excedido (+ header `Retry-After`).

---

### `GET /api/v1/export/excel`
Exporta transações em Excel (`.xlsx`).
- **Auth:** JWT Bearer
- **Rate limit:** 10 / hora
- **Query:** `ExportFiltersDto`
- **Response (200):** corpo binário (buffer).
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="transacoes_2026-06-27.xlsx"`
- **Erros:** `429` limite excedido.

---

### `GET /api/v1/export/pdf`
Exporta transações em PDF.
- **Auth:** JWT Bearer
- **Rate limit:** 10 / hora
- **Query:** `ExportFiltersDto`
- **Response (200):** corpo binário (buffer).
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="transacoes_2026-06-27.pdf"`
- **Erros:** `429` limite excedido.
