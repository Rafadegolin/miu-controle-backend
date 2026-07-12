# Notificações

Convenções globais: ver [README](./README.md).

Notificações in-app do usuário (alertas de orçamento, metas atingidas, etc.). São criadas pelo
backend (jobs/cron, eventos de meta) e também emitidas em tempo real via WebSocket (`notification.new`).
A listagem usa **paginação cursor-based** (ver README → Paginação).

Todos os endpoints exigem **JWT Bearer**.

`type` possíveis (`NotificationType`): `BUDGET_ALERT` · `BUDGET_EXCEEDED` · `GOAL_ACHIEVED` ·
`GOAL_MILESTONE` · `BILL_DUE` · `SYSTEM`.

---

### `GET /api/v1/notifications`
Lista notificações do usuário (mais recentes primeiro), com paginação cursor.
- **Auth:** JWT Bearer
- **Query:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `unreadOnly` | string (`"true"`/`"false"`) | não | **Default `true`** (só não lidas). Envie `false` para incluir lidas. Qualquer valor != `"false"` é tratado como `true`. |
| `cursor` | string | não | ID da última notificação da página anterior |
| `take` | string (número) | não | Itens por página (default `50`, máx `100`) |

- **Response (200):**
```jsonc
{
  "items": [
    {
      "id": "uuid",
      "userId": "uuid",
      "type": "BUDGET_ALERT",
      "title": "⚠️ Alerta de Orçamento",
      "message": "Você gastou 80% do orçamento de \"Alimentação\" ...",
      "read": false,
      "data": { "budgetId": "uuid", "categoryName": "Alimentação", "spent": 1200, "budget": 1500, "percentage": "80.00" },
      "createdAt": "2025-01-10T10:30:00.000Z"
    }
  ],
  "nextCursor": "uuid-ou-null",
  "hasMore": true
}
```
> O conteúdo de `data` varia por tipo de notificação (objeto livre JSON).

---

### `GET /api/v1/notifications/unread-count`
Conta as notificações não lidas.
- **Auth:** JWT Bearer
- **Response (200):**
```jsonc
{ "count": 5 }
```

---

### `POST /api/v1/notifications/mark-as-read`
Marca um conjunto de notificações como lidas (apenas as do próprio usuário).
- **Auth:** JWT Bearer
- **Body (`MarkAsReadDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `ids` | string[] | sim | array de UUID v4 (cada item) | `["uuid-1", "uuid-2"]` |

- **Response (200):**
```jsonc
{ "message": "2 notificação(ões) marcada(s) como lida(s)", "count": 2 }
```
- **Erros:** `400` validação (`ids` não é array de UUID v4).

---

### `POST /api/v1/notifications/mark-all-as-read`
Marca todas as notificações não lidas do usuário como lidas.
- **Auth:** JWT Bearer
- **Body:** nenhum.
- **Response (200):**
```jsonc
{ "message": "5 notificação(ões) marcada(s) como lida(s)", "count": 5 }
```

---

### `DELETE /api/v1/notifications/clear-read`
Remove todas as notificações **já lidas** do usuário.
- **Auth:** JWT Bearer
- **Response (200):**
```jsonc
{ "message": "12 notificação(ões) deletada(s)", "count": 12 }
```

---

### `DELETE /api/v1/notifications/:id`
Remove uma notificação específica (somente se pertencer ao usuário).
- **Auth:** JWT Bearer
- **Path params:** `id` — ID da notificação.
- **Response (200):**
```jsonc
{ "message": "Notificação deletada com sucesso" }
```
> Usa `deleteMany` com filtro `{ id, userId }`: se o ID não existir ou for de outro usuário, ainda
> retorna `200` com a mesma mensagem (nenhuma linha afetada). _(inferido — validar)_
