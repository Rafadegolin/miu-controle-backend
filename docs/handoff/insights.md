# Insights

Convenções globais: ver [README](./README.md).

Domínios de inteligência financeira: previsões de gastos, projeções de fluxo de caixa,
análise mensal, simulador "E se?" (cenários), planejamento de metas, colchão financeiro
(fundo de emergência), recomendações, health score e alertas proativos.

> Todas as rotas exigem **JWT Bearer** (`@UseGuards(JwtAuthGuard)` no controller), exceto
> onde indicado o contrário. Valores monetários chegam como **número** no JSON.

---

## Previsões (`/predictions`)

Previsão de gastos por categoria usando média móvel ponderada com sazonalidade.

### `GET /api/v1/predictions/variable-expenses`
Prevê o gasto das categorias **variáveis** do usuário para um mês.
- **Auth:** JWT Bearer
- **Query:**

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|-------|------|-------------|-----------|---------|
| `month` | string (`YYYY-MM`) | não | Mês alvo; default = mês atual | `2026-07` |

- **Response (200):**
```jsonc
{
  "month": "2026-07",
  "predictions": [
    {
      "categoryId": "uuid",
      "month": "2026-07-01T00:00:00.000Z",
      "predictedAmount": 850.40,
      "confidence": 72.5,           // 0-100 (escore bruto)
      "lowerBound": 700.10,
      "upperBound": 1000.70,
      "algorithm": "WEIGHTED_MOVING_AVG_W_SEASONALITY",
      "factors": {
        "seasonality": 1.05,
        "trend": "UP",              // "UP" | "DOWN"
        "historicalAverage": 820.00
      }
    }
    // categorias sem dados suficientes (<3 meses) são omitidas
  ]
}
```
- **Erros:** 401.

### `GET /api/v1/predictions/category/:categoryId`
Prevê o gasto de uma categoria específica para o **próximo mês**.
- **Auth:** JWT Bearer
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `categoryId` | string (uuid) | Categoria a prever |

- **Response (200):** o objeto `PredictionResultDto` (mesmo shape de cada item de `predictions` acima).
  Retorna **`null`** se não houver histórico suficiente (< 3 meses de dados).
```jsonc
{
  "categoryId": "uuid",
  "month": "2026-07-01T00:00:00.000Z",
  "predictedAmount": 850.40,
  "confidence": 72.5,
  "lowerBound": 700.10,
  "upperBound": 1000.70,
  "algorithm": "WEIGHTED_MOVING_AVG_W_SEASONALITY",
  "factors": { "seasonality": 1.05, "trend": "UP", "historicalAverage": 820.00 }
}
```
- **Erros:** 401.

---

## Projeções (`/projections`)

Projeção de fluxo de caixa futuro com cenários (realista / otimista / pessimista).

### `GET /api/v1/projections/cash-flow`
Projeta receitas, despesas e saldo acumulado para os próximos meses.
- **Auth:** JWT Bearer
- **Query (`CashFlowProjectionQueryDto`):**

| Campo | Tipo | Obrigatório | Validações | Default | Exemplo |
|-------|------|-------------|-----------|---------|---------|
| `months` | number | não | inteiro, 1–24 | `6` | `12` |
| `scenario` | enum | não | `REALISTIC` \| `OPTIMISTIC` \| `PESSIMISTIC` | `REALISTIC` | `OPTIMISTIC` |

- **Response (200, `CashFlowProjectionResponseDto`):**
```jsonc
{
  "initialBalance": 5200.00,
  "months": 6,
  "scenario": "REALISTIC",
  "data": [
    {
      "month": "2026-07",                         // YYYY-MM
      "income":   { "fixed": 5000, "variable": 800,  "total": 5800 },
      "expenses": { "fixed": 3200, "variable": 1500, "total": 4700 },
      "balance":  { "period": 1100, "accumulated": 6300 },
      "scenarios": { "optimistic": 6800, "pessimistic": 5800 } // opcional
    }
    // ... um item por mês
  ]
}
```
- **Erros:** 400 (validação de query), 401.

### `GET /api/v1/projections/balance-forecast`
Atalho que retorna apenas o saldo final projetado (último mês da projeção).
- **Auth:** JWT Bearer
- **Query:**

| Campo | Tipo | Obrigatório | Descrição | Default |
|-------|------|-------------|-----------|---------|
| `months` | string (numérico) | não | Horizonte em meses | `1` |

- **Response (200):**
```jsonc
{
  "forecastDate": "2026-07",       // YYYY-MM do último mês projetado
  "predictedBalance": 6300.00
}
```
- **Erros:** 401.

---

## Análise mensal (`/analysis`)

Relatório mensal comparativo (mês atual vs. mês anterior vs. média de 6 meses) com
anomalias, tendências e insights textuais. Persistido em `MonthlyReport`.

### `GET /api/v1/analysis/monthly-comparison`
Gera (upsert) e retorna o relatório mensal do mês informado.
- **Auth:** JWT Bearer
- **Query:**

| Campo | Tipo | Obrigatório | Descrição | Default |
|-------|------|-------------|-----------|---------|
| `month` | string (`YYYY-MM`) | não | Mês de referência | mês atual |

- **Response (200):** registro `MonthlyReport` _(inferido — validar)_.
```jsonc
{
  "id": "uuid",
  "userId": "uuid",
  "month": "2026-06-01T00:00:00.000Z",   // primeiro dia do mês
  "totalIncome": 5800.00,
  "totalExpense": 4700.00,
  "balance": 1100.00,
  "savingsRate": 18.96,                  // % economizado
  "topCategories": [ /* ranking de gastos (até 5) */ ],
  "anomalies": [ /* despesas fora do padrão (> 2 desvios) */ ],
  "trends": [ /* tendências de crescimento/queda */ ],
  "insights": [ /* frases geradas, ex: "Gasto em Lazer subiu 50%" */ ],
  "comparisonPrev": { "incomeDiff": 0, "expenseDiff": 0, "balanceDiff": 0 }, // vs mês anterior
  "comparisonAvg":  { "incomeDiff": 0, "expenseDiff": 0, "balanceDiff": 0 }, // vs média 6 meses
  "generatedAt": "2026-06-29T12:00:00.000Z"
}
```
- **Erros:** 401.

### `GET /api/v1/analysis/latest`
Retorna o relatório mensal mais recente já gerado para o usuário.
- **Auth:** JWT Bearer
- **Response (200):** registro `MonthlyReport` (mesmo shape acima) ou `null` se nenhum existir. _(inferido — validar)_
- **Erros:** 401.

---

## Cenários — Simulador "E se?" (`/scenarios`)

Simulação de decisões financeiras e verificação de viabilidade de compra.

> **Atenção:** o endpoint `POST /scenarios/compare` foi **removido** — não existe mais.

### `POST /api/v1/scenarios/simulate`
Simula o impacto de um cenário financeiro nos próximos 12 meses.
- **Auth:** JWT Bearer
- **Body (`SimulateScenarioDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `type` | enum | sim | `BIG_PURCHASE` \| `INCOME_LOSS` \| `EMERGENCY_EXPENSE` \| `NEW_RECURRING` \| `DEBT_PAYMENT` | `BIG_PURCHASE` |
| `amount` | number | sim | `>= 0` | `12000` |
| `paymentMethod` | string | não | livre (`CASH`, `CREDIT`, `LOAN`) | `CREDIT` |
| `installments` | number | não | — | `12` |
| `startDate` | string | sim | data ISO (`IsDateString`) | `2026-07-01` |
| `endDate` | string | não | data ISO; usado em cenários recorrentes | `2027-07-01` |
| `description` | string | não | livre | `Carro novo` |

- **Response (200, `ScenarioResultDto`):**
```jsonc
{
  "isViable": false,                         // saldo nunca fica negativo nos 12 meses
  "currentBalance": 5200.00,                 // soma dos saldos das contas
  "projectedBalance12Months": [4800, 4400, /* ... 12 valores */],
  "lowestBalance": -1500.00,
  "impactedGoals": [                         // populado de verdade
    "Todas as metas (Saldo negativo projetado)"
  ],
  "recommendations": [                       // só preenchido quando inviável
    { "type": "INSTALLMENT", "message": "Considere parcelar esta compra." },
    { "type": "DELAY", "message": "Saldo ficará negativo. Considere adiar esta decisão." },
    { "type": "CUT", "message": "Cortes em categorias não essenciais podem viabilizar: Lazer (R$ 200.00)." }
  ]
}
```
> `recommendations[].type` ∈ `CUT` | `DELAY` | `INSTALLMENT` | `EARN`. Não há mais o campo `alternativeScenarios`.
- **Erros:** 400 (validação), 401.

### `POST /api/v1/scenarios/affordability`
Responde "posso comprar isto?" combinando simulação com um scoring de 6 critérios (0–100).
- **Auth:** JWT Bearer
- **Body (`AffordabilityCheckDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `amount` | number | sim | `>= 0` | `1500` |
| `categoryId` | string | sim | não vazio | `uuid` |
| `paymentMethod` | enum | não | `CASH` \| `CREDIT_CARD` \| `DEBIT_CARD` \| `PIX` | `PIX` |
| `installments` | number | não | — | `3` |

- **Response (200, `AffordabilityResultDto`):**
```jsonc
{
  "score": 78,                               // 0-100 (arredondado)
  "status": "CAN_AFFORD",                    // CAN_AFFORD (70-100) | CAUTION (40-69) | NOT_RECOMMENDED (0-39)
  "badgeColor": "#10B981",                   // HEX (verde/amarelo/vermelho)
  "breakdown": {
    "balanceScore": 25,                      // máx 25
    "budgetScore": 20,                       // máx 20
    "reserveScore": 20,                      // máx 20
    "goalScore": 15,                         // máx 15
    "historyScore": 10,                      // máx 10
    "timingScore": 10                        // máx 10
  },
  "recommendations": [
    "🟢 Pode comprar! O impacto nas suas finanças é baixo."
  ]
}
```
> Não há mais o campo `alternatives`.
- **Erros:** 400 (validação), 401.

---

## Planejamento de metas (`/planning`)

Calcula o plano de depósitos para atingir uma meta e o persiste.

### `GET /api/v1/planning/goal/:goalId/calculate`
Simula o plano necessário para atingir a meta (depósito mensal, viabilidade, cortes sugeridos).
- **Auth:** JWT Bearer
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `goalId` | string (uuid) | Meta a planejar |

- **Response (200):** plano calculado (ou objeto curto se a meta já foi atingida).
```jsonc
// Meta ainda não atingida:
{
  "monthlyDeposit": 416.67,
  "months": 12,
  "isViable": true,
  "margin": 250.00,                 // folga mensal (surplus - depósito)
  "recommendations": ["Você tem uma margem de R$ 250.00. Ótimo!"],
  "actionPlan": [
    { "title": "Depósito Mensal", "description": "Configure uma recorrência de R$ 416.67",
      "value": 416.67, "type": "SAVE" }    // type: "CUT" | "SAVE" | "EARN"
  ],
  "suggestedCuts": [
    { "categoryId": "uuid", "categoryName": "Lazer", "currentAverage": 600, "amount": 150 }
  ]
}

// Meta já atingida:
{ "status": "COMPLETED", "message": "Objetivo já atingido!" }
```
- **Erros:** 401, 404 (meta não encontrada / não pertence ao usuário).

### `POST /api/v1/planning/goal/:goalId/save`
Persiste (upsert) o plano aprovado pelo usuário em `GoalPlan`.
- **Auth:** JWT Bearer
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `goalId` | string (uuid) | Meta cujo plano será salvo |

- **Body (`SavePlanDto`):** espelha o retorno de `/calculate`. A validação é estrita
  (`whitelist`), então **todos** os campos enviados devem estar abaixo.

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `monthlyDeposit` | number | sim | `IsNumber` | `416.67` |
| `months` | number | sim | `IsNumber` | `12` |
| `isViable` | boolean | sim | `IsBoolean` | `true` |
| `margin` | number | sim | `IsNumber` (folga mensal = surplus − depósito) | `250.0` |
| `recommendations` | string[] | sim | array de strings | `["..."]` |
| `actionPlan` | objeto[] | sim | array; cada item `{ title, description, value?, type }` | ver `/calculate` |
| `suggestedCuts` | objeto[] | sim | array de cortes sugeridos em categorias não essenciais | ver `/calculate` |

- **Response (200/201):** registro `GoalPlan` persistido. _(inferido — validar)_
```jsonc
{
  "id": "uuid",
  "goalId": "uuid",
  "monthlyDeposit": 416.67,
  "isViable": true,
  "actionPlan": { /* o objeto SavePlanDto completo, salvo como JSON */ },
  "createdAt": "2026-06-29T12:00:00.000Z",
  "updatedAt": "2026-06-29T12:00:00.000Z"
}
```
- **Erros:** 400 (validação), 401.

---

## Colchão financeiro / Fundo de emergência (`/emergency-fund`)

### `POST /api/v1/emergency-fund/setup`
Inicializa o colchão (meta default = 6 meses de despesas essenciais, mínimo R$ 1.000).
- **Auth:** JWT Bearer
- **Body:** nenhum.
- **Response (201):** registro `EmergencyFund` criado. _(inferido — validar)_
```jsonc
{
  "id": "uuid", "userId": "uuid",
  "targetAmount": 12000.00, "currentAmount": 0,
  "monthsCovered": 0, "linkedGoalId": null, "isActive": true,
  "createdAt": "2026-06-29T...", "updatedAt": "2026-06-29T..."
}
```
- **Erros:** 401.

### `GET /api/v1/emergency-fund/status`
Status calculado do colchão (cobertura, percentual, nível).
- **Auth:** JWT Bearer
- **Response (200):** se ainda não houver fundo, retorna status provisório com zeros.
```jsonc
{
  "currentAmount": 4000.00,
  "targetAmount": 12000.00,
  "monthsCovered": 2.0,
  "status": "WARNING",        // CRITICAL (<1 mês) | WARNING (1-3) | SECURE (>=3)
  "percentage": 33.3          // limitado a 100
}
```
- **Erros:** 401.

### `POST /api/v1/emergency-fund/withdraw`
Realiza um saque de emergência (registra histórico, debita o fundo e notifica).
- **Auth:** JWT Bearer
- **Body:**

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|-------|------|-------------|-----------|---------|
| `amount` | number | sim | Valor a sacar | `500` |
| `reason` | string | sim | Motivo do saque | `Conserto do carro` |

> _Sem DTO formal (`@Body() body: { amount, reason }`); a validação global de whitelist não se aplica a tipos inline._
- **Response (200):** registro `EmergencyFund` atualizado. _(inferido — validar)_
- **Erros:** 400 (saldo insuficiente), 401, 404 (fundo não encontrado).

### `POST /api/v1/emergency-fund/contribute`
Adiciona valor ao colchão (verifica marcos e atualiza meta vinculada, se houver).
- **Auth:** JWT Bearer
- **Body:**

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|-------|------|-------------|-----------|---------|
| `amount` | number | sim | Valor a adicionar | `300` |

- **Response (200):** registro `EmergencyFund` atualizado. _(inferido — validar)_
- **Erros:** 401, 404 (fundo não encontrado).

### `PATCH /api/v1/emergency-fund/update`
Atualiza a meta do colchão e/ou a meta vinculada.
- **Auth:** JWT Bearer
- **Body:**

| Campo | Tipo | Obrigatório | Descrição | Exemplo |
|-------|------|-------------|-----------|---------|
| `targetAmount` | number | não | Nova meta de valor | `15000` |
| `linkedGoalId` | string | não | Meta a vincular | `uuid` |

- **Response (200):** registro `EmergencyFund` atualizado. _(inferido — validar)_
- **Erros:** 401, 404 (fundo não encontrado).

### `GET /api/v1/emergency-fund/history`
Histórico de saques do colchão.
- **Auth:** JWT Bearer
- **Response (200):** array de `EmergencyFundWithdrawal` (mais recentes primeiro).
```jsonc
[
  {
    "id": "uuid", "fundId": "uuid",
    "amount": 500.00, "reason": "Conserto do carro",
    "approved": true, "createdAt": "2026-06-20T..."
  }
]
```
- **Erros:** 401, 404 (fundo não encontrado).

---

## Recomendações (`/recommendations`)

Recomendações financeiras geradas por analisadores (redução de gastos, otimização de
orçamento, oportunidades, alertas de risco, revisão de assinaturas).

### `GET /api/v1/recommendations`
Lista as recomendações **ativas** do usuário (ordenadas por prioridade desc).
- **Auth:** JWT Bearer
- **Response (200):** array de `Recommendation`.
```jsonc
[
  {
    "id": "uuid", "userId": "uuid",
    "type": "REDUCE_EXPENSE",          // REDUCE_EXPENSE | OPTIMIZE_BUDGET | SAVINGS_OPPORTUNITY | RISK_ALERT | SUBSCRIPTION_REVIEW
    "category": "Gastos",
    "title": "Reduza gastos com delivery",
    "description": "...",
    "impact": 150.00,                  // economia estimada (R$)
    "difficulty": 2,                   // 1-5
    "priority": 120,                   // 0-200
    "status": "ACTIVE",                // ACTIVE | APPLIED | DISMISSED | EXPIRED
    "appliedAt": null, "dismissedAt": null, "expiresAt": null,
    "createdAt": "2026-06-...", "updatedAt": "2026-06-..."
  }
]
```
- **Erros:** 401.

### `POST /api/v1/recommendations/generate`
Força a geração de recomendações (uso em testes) e retorna a lista ativa atualizada.
- **Auth:** JWT Bearer
- **Body:** nenhum.
- **Response (201):** array de `Recommendation` (mesmo shape de `GET /recommendations`).
- **Erros:** 401.

### `POST /api/v1/recommendations/:id/apply`
Marca uma recomendação como aplicada.
- **Auth:** JWT Bearer
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `id` | string (uuid) | Recomendação a aplicar |

- **Response (200/201):** `Recommendation` com `status: "APPLIED"` e `appliedAt` preenchido.
- **Erros:** 401, 404 (recomendação não encontrada).

### `POST /api/v1/recommendations/:id/dismiss`
Descarta uma recomendação.
- **Auth:** JWT Bearer
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `id` | string (uuid) | Recomendação a descartar |

- **Response (200/201):** `Recommendation` com `status: "DISMISSED"` e `dismissedAt` preenchido.
- **Erros:** 401, 404.

---

## Health Score (`/health-score`)

Pontuação de saúde financeira (0–1000) com sub-pontuações, conquistas e insights de IA.

### `GET /api/v1/health-score`
Retorna o health score atual do usuário (calcula sob demanda se ainda não existir).
- **Auth:** JWT Bearer
- **Response (200):** registro `HealthScore`.
```jsonc
{
  "id": "uuid", "userId": "uuid",
  "totalScore": 720,            // 0-1000
  "consistencyScore": 240,      // 0-300
  "budgetScore": 200,           // 0-250
  "goalsScore": 150,            // 0-200
  "emergencyScore": 75,         // 0-150
  "diversityScore": 55,         // 0-100
  "level": "GOOD",              // CRITICAL | ATTENTION | HEALTHY | GOOD | EXCELLENT
  "aiInsights": "Texto gerado pela IA com dicas",   // pode ser null
  "lastAiAnalysisAt": "2026-06-...",                // pode ser null
  "updatedAt": "2026-06-..."
}
```
- **Erros:** 401.

### `GET /api/v1/health-score/achievements`
Lista as conquistas do usuário (desbloqueadas + bloqueadas + total de pontos).
- **Auth:** JWT Bearer
- **Response (200):**
```jsonc
{
  "unlocked": [
    { "id": "uuid", "code": "FIRST_TRANSACTION", "name": "...", "points": 50, "unlockedAt": "2026-06-..." }
  ],
  "locked": [ /* objetos Achievement ainda não desbloqueados */ ],
  "totalPoints": 50
}
```
- **Erros:** 401.

### `POST /api/v1/health-score/refresh-insights`
Força a regeração dos insights de IA do health score.
- **Auth:** JWT Bearer
- **Body:** nenhum.
- **Response (200/201):**
```jsonc
{ "insight": "Texto gerado pela IA" }
// ou, se IA não configurada / sem score:
// { "message": "AI not configured" }   |   null   |   { "error": "Failed to generate insights" }
```
- **Erros:** 401.

---

## Alertas proativos (`/proactive-alerts`)

Alertas gerados por verificações diárias (saldo negativo, conta a vencer, orçamento, etc.).

### `GET /api/v1/proactive-alerts`
Lista os alertas ativos (não dispensados) do usuário, mais recentes primeiro.
- **Auth:** JWT Bearer
- **Response (200):** array de `ProactiveAlert`.
```jsonc
[
  {
    "id": "uuid", "userId": "uuid",
    "type": "NEGATIVE_BALANCE",   // NEGATIVE_BALANCE | BILL_DUE | BUDGET_WARNING | POSITIVE_STREAK
    "priority": "CRITICAL",       // CRITICAL | WARNING | INFO | POSITIVE
    "message": "Seu saldo ficará negativo em 5 dias.",
    "aiInsight": "Texto gerado pela IA",   // pode ser null
    "actionable": true,
    "actionUrl": "/transactions",          // pode ser null
    "dismissed": false, "read": false,
    "createdAt": "2026-06-...", "updatedAt": "2026-06-..."
  }
]
```
- **Erros:** 401.

### `POST /api/v1/proactive-alerts/:id/dismiss`
Marca um alerta como dispensado.
- **Auth:** JWT Bearer
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `id` | string (uuid) | Alerta a dispensar |

- **Response (200/201):** `ProactiveAlert` com `dismissed: true`.
- **Erros:** 401, 404 (alerta não encontrado / não pertence ao usuário).

### `POST /api/v1/proactive-alerts/run-checks`
Executa manualmente as verificações diárias para todos os usuários.
- **Auth:** JWT Bearer **+ Role ADMIN** (`RolesGuard` + `@Roles(Role.ADMIN)`).
- **Body:** nenhum.
- **Response (200/201):**
```jsonc
{ "message": "Checks executed" }
```
- **Erros:** 401 (sem token), 403 (não-ADMIN).
