# Objetivos (Potes / Metas)

Convenções globais: ver [README](./README.md).

Metas de poupança ("potes"). Suportam **hierarquia** (até 4 níveis: pai → filho → neto → bisneto),
**contribuições/retiradas**, **imagem** (upload S3), e **links de compra** (JSON embutido na meta).

Quando uma meta tem filhos, uma contribuição no pai é **distribuída** entre os filhos conforme
`distributionStrategy` (`PROPORTIONAL` por padrão / fallback, ou `SEQUENTIAL`), e o `currentAmount`
do pai é recalculado como a soma dos filhos (propagando para cima na árvore).

Campos calculados nas leituras de meta: `percentage` (`currentAmount/targetAmount*100`, 2 casas),
`remaining`, `isOverdue` (`targetDate < hoje`), `daysRemaining`.

---

### `POST /api/v1/goals`
Cria um novo objetivo.
- **Auth:** JWT Bearer
- **Body (`CreateGoalDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `name` | string | sim | sanitizado; 3–255 chars | `"Viagem para Europa"` |
| `description` | string | não | sanitizado; ≤ 500 chars | `"Guardar para férias"` |
| `targetAmount` | number | sim | `>= 0.01` | `15000.0` |
| `targetDate` | string (date) | não | ISO date; deve ser **no futuro** | `"2026-07-01"` |
| `color` | string | não | default `#10B981` | `"#10B981"` |
| `icon` | string | não | — | `"plane"` |
| `priority` | int | não | `1`–`5` (1=alta, default `3`) | `1` |

> O service também aceita `parentId` e `distributionStrategy` (hierarquia, issue #65), porém esses
> campos **não constam no `CreateGoalDto`** — com `forbidNonWhitelisted: true` global, enviá-los
> resultaria em `400`. Tratar como **não suportado via API pública** até o DTO ser atualizado. _(inferido — validar)_

- **Response (201):** objeto Goal criado (`status: "ACTIVE"`, `currentAmount: 0`, `hierarchyLevel: 0`).
- **Erros:** `400` `targetDate` no passado; validação de DTO.

---

### `GET /api/v1/goals`
Lista os objetivos do usuário, com campos calculados e contagem de contribuições.
- **Auth:** JWT Bearer
- **Query:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `status` | enum `GoalStatus` | não | `ACTIVE` \| `COMPLETED` \| `CANCELLED` |

- **Response (200):** array, ordenado por `priority asc`, `targetDate asc`, `createdAt desc`:
```jsonc
[
  {
    "id": "uuid",
    "name": "Viagem para Europa",
    "targetAmount": 15000,
    "currentAmount": 7500,
    "status": "ACTIVE",
    "targetDate": "2026-07-01T00:00:00.000Z",
    "color": "#10B981",
    "icon": "plane",
    "priority": 1,
    "_count": { "contributions": 12 },
    "percentage": 50,          // calculado
    "remaining": 7500,         // targetAmount - currentAmount
    "isOverdue": false,        // targetDate < agora
    "daysRemaining": 180       // null se sem targetDate
  }
]
```

---

### `GET /api/v1/goals/summary`
Resumo agregado de todas as metas. **Cache: 10 min.**
- **Auth:** JWT Bearer
- **Response (200):**
```jsonc
{
  "total": 8,
  "active": 5,
  "completed": 2,
  "cancelled": 1,
  "totalTargeted": 50000,     // soma targetAmount das ATIVAS
  "totalSaved": 22000,        // soma currentAmount das ATIVAS
  "totalRemaining": 28000,
  "overallProgress": 44,      // totalSaved/totalTargeted*100 (0 se não houver ativas)
  "goals": [
    {
      "id": "uuid",
      "name": "Viagem para Europa",
      "status": "ACTIVE",
      "percentage": 50,
      "currentAmount": 7500,
      "targetAmount": 15000,
      "color": "#10B981",
      "icon": "plane"
    }
  ]
}
```

---

### `GET /api/v1/goals/hierarchy`
Lista a árvore de objetivos: apenas raízes (`parentId = null`), com filhos aninhados até 4 níveis.
- **Auth:** JWT Bearer
- **Response (200):** array de objetivos raiz; cada um inclui `children` (recursivo até 3 níveis de profundidade). Ordenado por `priority desc`.
```jsonc
[
  {
    "id": "uuid",
    "name": "Casa própria",
    "parentId": null,
    "hierarchyLevel": 0,
    "currentAmount": 30000,
    "targetAmount": 100000,
    "distributionStrategy": "PROPORTIONAL",
    "children": [
      { "id": "...", "name": "Entrada", "children": [ { "...": "...", "children": [] } ] }
    ]
  }
]
```
> Objetos crus do Prisma — **sem** `percentage`/`remaining` calculados (diferente de `GET /goals`). _(inferido — validar)_

---

### `GET /api/v1/goals/:id`
Busca um objetivo por ID, com histórico de contribuições e campos calculados.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do objetivo.
- **Response (200):**
```jsonc
{
  "id": "uuid",
  "name": "Viagem para Europa",
  "targetAmount": 15000,
  "currentAmount": 7500,
  "status": "ACTIVE",
  "imageUrl": "https://...", "imageKey": "...",
  "purchaseLinks": [ /* ver seção Links de compra */ ],
  "contributions": [
    {
      "id": "uuid", "goalId": "uuid", "amount": 500, "date": "2025-11-28T00:00:00.000Z",
      "transactionId": "uuid-ou-null",
      "transaction": { "id": "...", "description": "...", "date": "..." }  // null se sem transação
    }
  ],
  "_count": { "contributions": 12 },
  "percentage": 50,
  "remaining": 7500,
  "isOverdue": false,
  "daysRemaining": 180
}
```
- **Erros:** `404` não encontrado · `403` pertence a outro usuário.

---

### `POST /api/v1/goals/:id/contribute`
Adiciona uma contribuição ao objetivo. Se a meta tiver filhos, o valor é **distribuído** entre eles.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do objetivo.
- **Body (`ContributeGoalDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `amount` | number | sim | `>= 0.01` | `500.0` |
| `date` | string (date) | não | ISO date (default: hoje) | `"2025-11-28"` |
| `transactionId` | string | não | deve existir e pertencer ao usuário | `"uuid-transacao"` |

- **Comportamento:** ao atingir/ultrapassar `targetAmount`, a meta-folha vira `COMPLETED` (seta `completedAt` e dispara notificação `GOAL_ACHIEVED`). Emite evento de gamificação `goal.contributed`.
- **Response (200):**
  - **Meta folha (sem filhos):**
    ```jsonc
    { "contribution": { "id": "...", "goalId": "...", "amount": 500, "date": "..." },
      "goal": { /* meta com currentAmount atualizado (+ status/completedAt se concluída) */ } }
    ```
  - **Meta com filhos:** retorna o objeto da meta (mesmo shape de `GET /goals/:id`) após distribuir e recalcular. _(inferido — validar)_
- **Erros:** `404` meta ou transação não encontrada · `403` sem permissão · `400` meta não está `ACTIVE`.

---

### `POST /api/v1/goals/:id/withdraw`
Retira valor do objetivo (cria contribuição negativa). Se estava `COMPLETED`, volta para `ACTIVE`.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do objetivo.
- **Body:** objeto livre `{ amount: number }` (não há DTO com class-validator — o controller lê `body.amount` diretamente).

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|------------|
| `amount` | number | sim | menor ou igual ao `currentAmount` (senão `400`) |

- **Response (200):**
```jsonc
{
  "contribution": { "id": "...", "goalId": "...", "amount": -500, "date": "..." },
  "goal": { /* meta atualizada */, "percentage": 46.67, "remaining": 8000 }
}
```
- **Erros:** `400` valor de retirada maior que o saldo · `404` não encontrado · `403` sem permissão.

---

### `PATCH /api/v1/goals/:id`
Atualiza um objetivo. Marcar `status: "COMPLETED"` seta `completedAt`.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do objetivo.
- **Body (`UpdateGoalDto`):** todos os campos de `CreateGoalDto` (opcionais) + `status`.

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|------------|
| `name` | string | não | sanitizado; 3–255 chars |
| `description` | string | não | sanitizado; ≤ 500 chars |
| `targetAmount` | number | não | `>= 0.01` |
| `targetDate` | string (date) | não | ISO date; **no futuro** |
| `color` | string | não | — |
| `icon` | string | não | — |
| `priority` | int | não | `1`–`5` |
| `status` | enum `GoalStatus` | não | `ACTIVE` \| `COMPLETED` \| `CANCELLED` |

- **Response (200):** Goal atualizado.
- **Erros:** `400` `targetDate` no passado · `404` não encontrado · `403` sem permissão.

---

### `DELETE /api/v1/goals/:id`
Remove um objetivo. **Bloqueado** se houver contribuições.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do objetivo.
- **Response (200):**
```jsonc
{ "message": "Objetivo deletado com sucesso" }
```
- **Erros:** `400` meta tem contribuições (use cancelar em vez de deletar) · `404` não encontrado · `403` sem permissão.

---

## Imagens

### `POST /api/v1/goals/:id/image`
Faz upload da imagem da meta (substitui a anterior, se houver).
- **Auth:** JWT Bearer
- **Content-Type:** `multipart/form-data`
- **Path params:** `id` — ID do objetivo.
- **Body (multipart):** campo **`image`** (arquivo). Obrigatório. Máx **5 MB**. Tipos: `jpg`, `jpeg`, `png`, `webp`.
- **Response (201):**
```jsonc
{
  "message": "Imagem da meta atualizada com sucesso",
  "goal": { /* meta com imageUrl, imageKey, imageMimeType, imageSize atualizados */ }
}
```
- **Erros:** `400` meta não encontrada / arquivo ausente / tipo ou tamanho inválido.

---

### `DELETE /api/v1/goals/:id/image`
Remove a imagem da meta (apaga do storage e limpa os campos).
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do objetivo.
- **Response (200):**
```jsonc
{ "message": "Imagem removida com sucesso", "goal": { /* meta com campos de imagem nulos */ } }
```
- **Erros:** `400` meta não encontrada · `400` meta não possui imagem.

---

## Links de compra

Os links são armazenados como JSON embutido na meta (campo `purchaseLinks`). **Máx 10 por meta.**
Cada link: `{ id, title, url, price?, currency?, note?, addedAt, updatedAt? }`.

### `POST /api/v1/goals/:id/purchase-links`
Adiciona um link de compra à meta.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do objetivo.
- **Body (`AddPurchaseLinkDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `title` | string | sim | não vazio; ≤ 200 chars | `"MacBook Pro M3"` |
| `url` | string | sim | URL válida **HTTPS** (protocolo obrigatório) | `"https://amazon.com.br/..."` |
| `price` | number | não | `>= 0` | `12500.0` |
| `currency` | string | não | 3 letras maiúsculas (`/^[A-Z]{3}$/`), default `BRL` | `"BRL"` |
| `note` | string | não | ≤ 500 chars | `"Aguardar Black Friday"` |

- **Response (201):**
```jsonc
{ "message": "Link adicionado com sucesso", "goal": { /* meta com purchaseLinks atualizado + _count.contributions */ } }
```
- **Erros:** `400` máximo de 10 links atingido · `404`/`403` meta · validação de DTO.

---

### `PATCH /api/v1/goals/:id/purchase-links/:linkId`
Atualiza um link de compra existente.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do objetivo · `linkId` — ID do link.
- **Body (`UpdatePurchaseLinkDto`):** todos os campos de `AddPurchaseLinkDto`, **opcionais** (`PartialType`).
- **Response (200):**
```jsonc
{ "message": "Link atualizado com sucesso", "goal": { /* meta atualizada */ } }
```
- **Erros:** `404` link não encontrado · `404`/`403` meta.

---

### `DELETE /api/v1/goals/:id/purchase-links/:linkId`
Remove um link de compra da meta.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do objetivo · `linkId` — ID do link.
- **Response (200):**
```jsonc
{ "message": "Link removido com sucesso", "goal": { /* meta atualizada */ } }
```
- **Erros:** `404` link não encontrado · `404`/`403` meta.

---

### `GET /api/v1/goals/:id/purchase-links/summary`
Resumo dos preços dos links de compra da meta.
- **Auth:** JWT Bearer
- **Path params:** `id` — ID do objetivo.
- **Response (200):**
```jsonc
{
  "total": 3,                       // quantidade de links
  "totalBRL": 12500,                // soma dos preços em BRL (MVP só agrega BRL)
  "byCurrenty": { "BRL": 12500, "USD": 800 },  // nota: chave grafada "byCurrenty" no código
  "links": [ /* lista completa de links */ ]
}
```
> O nome do campo é literalmente **`byCurrenty`** (typo no código) — não `byCurrency`.
- **Erros:** `404`/`403` meta.
