# IA

Convenções globais: ver [README](./README.md).

Domínio de Inteligência Artificial: configuração de chaves/modelos por usuário (OpenAI / Gemini),
métricas de uso e custo, e analytics preditivo (previsão, detecção de anomalias, tendências e
projeção de metas).

Todas as rotas exigem **JWT Bearer** (`@UseGuards(JwtAuthGuard)` no nível de cada controller).
Não há `RolesGuard`/`@Roles` nem overrides de rate limit (`@Throttle`/`@SkipThrottle`) neste domínio —
valem os tiers globais do [README](./README.md).

> **Chaves de API:** as chaves OpenAI/Gemini são criptografadas (`EncryptionService`) antes de
> persistir e **nunca** são retornadas nas respostas — apenas os flags booleanos `hasOpenAiKey` /
> `hasGeminiKey`.

---

## Configuração de IA (`/ai/config`)

### `POST /api/v1/ai/config`
Salva (upsert) a configuração de IA do usuário: valida e criptografa as chaves fornecidas e grava as preferências de modelo/limites.
- **Auth:** JWT Bearer
- **Body (`SaveAiConfigDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `openaiApiKey` | string | não | `@IsString`; se enviada, é validada via OpenAI e criptografada | `"sk-proj-abc123..."` |
| `geminiApiKey` | string | não | `@IsString`; se enviada, é validada via Gemini e criptografada | `"AIzaSy..."` |
| `isAiEnabled` | boolean | não | `@IsBoolean` (default `true`) | `true` |
| `monthlyTokenLimit` | int | não | `@IsInt`, `>= 0` (default `1000000`) | `1000000` |
| `categorizationModel` | string | não | `@IsString` (default `"gpt-4o-mini"`) | `"gpt-4o-mini"` |
| `analyticsModel` | string | não | `@IsString` (default `"gemini-1.5-flash"`) | `"gemini-1.5-flash"` |

- **Response (201):**
```jsonc
{
  "message": "Configuração de IA salva com sucesso",
  "config": {
    "isAiEnabled": true,
    "monthlyTokenLimit": 1000000,
    "categorizationModel": "gpt-4o-mini",
    "analyticsModel": "gemini-1.5-flash",
    "hasOpenAiKey": true,   // só indica presença da chave; a chave não é retornada
    "hasGeminiKey": false,
    "lastTestedAt": "2026-06-27T12:00:00.000Z"
  }
}
```
- **Erros:**
  - `400` validação de DTO (campos não declarados / tipos inválidos).
  - `400` chave inválida — quando `openaiApiKey`/`geminiApiKey` é enviada mas reprova no teste do provedor (lançado como `Error('API key OpenAI inválida.')` / `Error('API key Gemini inválida.')`). _(inferido — validar status; é um `Error` genérico, pode chegar como `500`)_
  - `401` sem token.

---

### `GET /api/v1/ai/config`
Retorna a configuração de IA atual do usuário (sem expor as chaves). Se não houver configuração, devolve `configured: false`.
- **Auth:** JWT Bearer
- **Response (200) — configurado:**
```jsonc
{
  "configured": true,
  "isAiEnabled": true,
  "monthlyTokenLimit": 1000000,
  "categorizationModel": "gpt-4o-mini",
  "analyticsModel": "gemini-1.5-flash",
  "lastTestedAt": "2026-06-27T12:00:00.000Z",
  "isKeyValid": true,
  "hasOpenAiKey": true,
  "hasGeminiKey": false,
  "createdAt": "2026-06-01T10:00:00.000Z",
  "updatedAt": "2026-06-27T12:00:00.000Z"
}
```
- **Response (200) — não configurado:**
```jsonc
{
  "configured": false,
  "message": "Nenhuma configuração de IA encontrada"
}
```
- **Erros:** `401` sem token.

---

### `PATCH /api/v1/ai/config`
Atualiza apenas as preferências (não altera chaves de API). Requer configuração existente.
- **Auth:** JWT Bearer
- **Body (`UpdateAiConfigDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `isAiEnabled` | boolean | não | `@IsBoolean` | `true` |
| `monthlyTokenLimit` | int | não | `@IsInt`, `>= 0` | `2000000` |
| `categorizationModel` | string | não | `@IsString` | `"gpt-4o-mini"` |
| `analyticsModel` | string | não | `@IsString` | `"gemini-1.5-flash"` |

- **Response (200):**
```jsonc
{
  "message": "Configuração atualizada com sucesso",
  "config": {
    "isAiEnabled": true,
    "monthlyTokenLimit": 2000000,
    "categorizationModel": "gpt-4o-mini",
    "analyticsModel": "gemini-1.5-flash",
    "updatedAt": "2026-06-27T12:30:00.000Z"
  }
}
```
- **Erros:**
  - `400` validação de DTO.
  - `404` nenhuma configuração existente para atualizar (`prisma.update` em registro inexistente). _(inferido — validar)_
  - `401` sem token.

---

### `DELETE /api/v1/ai/config`
Remove a configuração de IA do usuário (apaga também as chaves criptografadas).
- **Auth:** JWT Bearer
- **Response (204):** sem corpo (`@HttpCode(204)`).
- **Erros:**
  - `404` nenhuma configuração para remover (`prisma.delete` em registro inexistente). _(inferido — validar)_
  - `401` sem token.

---

### `POST /api/v1/ai/config/test`
Testa uma chave de API contra o provedor **sem salvá-la**. Se `openaiApiKey` e `geminiApiKey` forem enviadas, apenas a OpenAI é testada (prioridade no `else if`).
- **Auth:** JWT Bearer
- **Body (`TestApiKeyDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `openaiApiKey` | string | não | `@IsString` | `"sk-proj-abc123..."` |
| `geminiApiKey` | string | não | `@IsString` | `"AIzaSy..."` |

- **Response (200):**
```jsonc
{
  "valid": true,
  "message": "API key OpenAI válida"
  // mensagens possíveis: "API key OpenAI válida/inválida",
  //                       "API key Gemini válida/inválida",
  //                       "Nenhuma chave fornecida" (quando body vazio → valid: false)
}
```
- **Erros:** `400` validação de DTO · `401` sem token.

---

## Uso e custos

### `GET /api/v1/ai/usage-stats`
Estatísticas mensais de consumo de IA (tokens, custo em USD e BRL, e detalhamento por feature) referentes ao mês corrente.
- **Auth:** JWT Bearer
- **Response (200):**
```jsonc
{
  "month": "junho de 2026",          // formatado pt-BR (mês por extenso + ano)
  "totalTokens": 125000,
  "totalCost": 0.018750,             // USD, 6 casas decimais
  "totalCostBRL": 0.10,              // conversão aproximada (totalCost * 5.5), 2 casas
  "byFeature": {
    // chave = AiFeatureType (ex.: CATEGORIZATION, PREDICTIVE_ANALYTICS, ANOMALY_DETECTION...)
    "CATEGORIZATION": { "tokens": 80000, "cost": 0.012, "requests": 40 },
    "PREDICTIVE_ANALYTICS": { "tokens": 45000, "cost": 0.00675, "requests": 3 }
  }
}
```
> `byFeature` é um mapa dinâmico cujas chaves são os valores do enum `AiFeatureType` efetivamente usados no mês; vem `{}` se não houver uso.
- **Erros:** `401` sem token.

---

### `GET /api/v1/ai/categorization-stats`
Métricas de desempenho da categorização automática (precisão, confiança média e taxa de correção), derivadas das métricas de uso e do feedback de correção do usuário.
- **Auth:** JWT Bearer
- **Response (200):**
```jsonc
{
  "totalPredictions": 40,        // nº de métricas CATEGORIZATION com success=true
  "averageConfidence": 0.87,     // média da confiança nos feedbacks, 2 casas (0 se sem feedback)
  "accuracy": 92.5,              // % de feedbacks corretos (0–100, 1 casa)
  "correctionRate": 7.5,         // % correções sobre o total de previsões (0–100, 1 casa)
  "message": "40 transações categorizadas com 92% de precisão"
  // quando totalPredictions === 0: "Nenhuma categorização realizada ainda"
}
```
- **Erros:** `401` sem token.

---

## Analytics (`/ai/analytics`)

### `GET /api/v1/ai/analytics/forecast`
Gera a previsão financeira para o próximo mês combinando regressão linear sobre os últimos 12 meses e análise da IA (Gemini/OpenAI, com fallback entre provedores). Persiste a previsão em `predictionHistory`.
- **Auth:** JWT Bearer
- **Response (200) — dados suficientes (>= 3 meses de histórico):**
```jsonc
{
  "available": true,
  "forecast": {
    "summary": "Resumo em 1-2 frases",
    "healthScore": 72,             // 0–100
    "predictedExpense": 3200.50,
    "predictedIncome": 5000.00,
    "savingsGoal": 800,
    "insights": ["insight 1", "insight 2", "insight 3"],
    "recommendation": "Ação principal em 1 frase"
  },
  "trends": {
    "predictedExpense": 3150.00,   // regressão linear (não-negativo)
    "predictedIncome": 4980.00,
    "expenseTrendSlope": 12.5,
    "incomeTrendSlope": -3.2,
    "isExpenseAnomaly": false,     // último mês > 1.5x média de despesas
    "lastMonthData": { "period": "2026-06", "income": 5000, "expense": 3300, "count": 42, "balance": 1700 }
  },
  "usedFallback": false,
  "provider": "GEMINI"             // ou "OPENAI"
}
```
- **Response (200) — dados insuficientes (< 3 meses):**
```jsonc
{
  "available": false,
  "reason": "Dados insuficientes. Precisamos de pelo menos 3 meses de histórico."
}
```
- **Erros:**
  - `401` sem token.
  - `4xx/5xx` falha do provedor de IA / chave ausente ou esgotada sem fallback disponível (erro propagado do serviço). _(inferido — validar status)_

---

### `GET /api/v1/ai/analytics/anomalies`
Lista as anomalias detectadas para o usuário (limite de 50, ordenadas por `detectedAt desc`), com filtros opcionais.
- **Auth:** JWT Bearer
- **Query (`AnomalyQueryDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `minScore` | number | não | `@IsNumber`, `0`–`1` (default `0.8`); filtra `anomalyScore >= minScore` | `0.8` |
| `minSeverity` | enum string | não | um de `LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL`; filtra `severity in [minSeverity, 'CRITICAL']` | `"HIGH"` |
| `includeDismissed` | boolean | não | default `false`; se `false`, retorna só `isDismissed=false` | `false` |

- **Response (200):** array de registros `AnomalyDetection` (Prisma cru):
```jsonc
[
  {
    "id": "uuid",
    "userId": "uuid",
    "transactionId": "uuid",
    "anomalyType": "HIGH_VALUE",
    "severity": "HIGH",            // LOW | MEDIUM | HIGH | CRITICAL
    "anomalyScore": 0.92,
    "description": "Valor R$1500.00 é muito atípico (Z-Score: 4.3)",
    "expectedValue": 250.0,
    "actualValue": 1500.0,
    "deviation": 500.0,            // % de desvio sobre a média
    "historicalAverage": 250.0,
    "historicalStdDev": 120.0,
    "isDismissed": false,
    "dismissedAt": null,
    "detectedAt": "2026-06-20T08:00:00.000Z"
  }
]
```
> _(shape do registro inferido do schema Prisma `AnomalyDetection` / criação no service — validar campos exatos)_
- **Erros:** `400` validação de query (`minScore` fora de 0–1, `minSeverity` inválido) · `401` sem token.

---

### `POST /api/v1/ai/analytics/anomalies/:id/dismiss`
Descarta (marca como ignorada) uma anomalia do usuário.
- **Auth:** JWT Bearer
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | ID da anomalia (`AnomalyDetection.id`) |

- **Response (200):** registro `AnomalyDetection` atualizado, com `isDismissed: true` e `dismissedAt` preenchido.
```jsonc
{
  "id": "uuid",
  "userId": "uuid",
  "isDismissed": true,
  "dismissedAt": "2026-06-27T12:00:00.000Z"
  // demais campos do registro AnomalyDetection
}
```
- **Erros:**
  - `404` anomalia não encontrada para o usuário (`where: { id, userId }` sem match). _(inferido — validar)_
  - `401` sem token.

---

### `GET /api/v1/ai/analytics/trends`
Calcula tendências financeiras para o período escolhido (regressão linear + taxa de crescimento de receitas/despesas), retornando também o histórico mensal para gráficos.
- **Auth:** JWT Bearer
- **Query:**

| Param | Tipo | Obrigatório | Validações | Default |
|-------|------|-------------|------------|---------|
| `period` | enum string | não | `3M` \| `6M` \| `1Y` (mapeados para 3/6/12 meses) | `6M` |

> `period` é lido cru via `@Query('period')` (sem DTO/validação estrita): valores fora de `3M`/`6M` caem em 12 meses (`1Y`).
- **Response (200):**
```jsonc
{
  "period": "6M",
  "predictedExpense": 3150.00,
  "predictedIncome": 4980.00,
  "expenseTrendSlope": 12.5,
  "incomeTrendSlope": -3.2,
  "isExpenseAnomaly": false,
  "lastMonthData": { "period": "2026-06", "income": 5000, "expense": 3300, "count": 42, "balance": 1700 },
  "incomeGrowth": 8.4,           // % crescimento (primeiro → último mês do período)
  "expenseGrowth": -2.1,
  "history": [
    { "period": "2026-01", "income": 4600, "expense": 3000, "count": 38, "balance": 1600 }
    // ... um item por mês do período
  ]
}
```
- **Erros:** `401` sem token.

---

### `GET /api/v1/ai/analytics/goal-forecast/:goalId`
Projeta a data estimada de conclusão de uma meta, com base na velocidade média de contribuições dos últimos 90 dias.
- **Auth:** JWT Bearer
- **Path params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `goalId` | string | ID da meta (`Goal.id`) |

> O `userId` autenticado não é usado no filtro da consulta da meta (apenas `where: { id: goalId }`); a previsão é feita por `goalId`.
- **Response (200) — em progresso (`ON_TRACK`):**
```jsonc
{
  "goalId": "uuid",
  "remaining": 1200.0,
  "velocityPerMonth": 300.0,      // contribuição média mensal (diária * 30)
  "estimatedDate": "2026-10-25T00:00:00.000Z",
  "status": "ON_TRACK",
  "daysToFinish": 120
}
```
- **Response (200) — já concluída (`remaining <= 0`):**
```jsonc
{
  "goalId": "uuid",
  "status": "COMPLETED",
  "remaining": 0,
  "estimatedDate": "2026-06-27T12:00:00.000Z"   // data atual
}
```
- **Response (200) — sem contribuições recentes (`STALLED`):**
```jsonc
{
  "goalId": "uuid",
  "remaining": 1200.0,
  "status": "STALLED",
  "estimatedDate": null,
  "message": "Nenhuma contribuição nos últimos 90 dias."
}
```
- **Erros:**
  - `404` meta não encontrada (lançado como `Error('Meta não encontrada')`). _(inferido — validar status; é `Error` genérico, pode chegar como `500`)_
  - `401` sem token.
