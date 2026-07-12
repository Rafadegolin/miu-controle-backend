# Usuários

Convenções globais: ver [README](./README.md).

Perfil do usuário logado, troca de senha, avatar, exclusão de conta e rotas administrativas de usuários.

> Todas as rotas exigem **JWT Bearer** (guard aplicado no controller inteiro). As rotas `/users/admin/*` exigem adicionalmente **Role ADMIN**.

---

### `GET /api/v1/users/me`
Retorna o perfil completo do usuário logado, com contadores.
- **Auth:** JWT Bearer
- **Response (200):**
```jsonc
{
  "id": "uuid",
  "email": "joao@email.com",
  "fullName": "João Silva",
  "phone": "+5511999999999",        // pode ser null
  "avatarUrl": "https://...",       // pode ser null
  "emailVerified": true,
  "twoFactorEnabled": false,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "lastLoginAt": "2026-06-27T12:00:00.000Z",
  "subscription": { "plan": "FREE" },
  "subscriptionTier": "FREE",
  "_count": { "accounts": 3, "transactions": 120, "goals": 2 }
}
```
- **Erros:** `401`, `404` (usuário não encontrado).

---

### `PATCH /api/v1/users/me`
Atualiza dados do perfil (nome e/ou telefone).
- **Auth:** JWT Bearer
- **Body (`UpdateProfileDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `fullName` | string | não | 3–255 caracteres | `"João Silva"` |
| `phone` | string | não | telefone BR válido (`IsPhoneNumber('BR')`) | `"+5511999999999"` |

- **Response (200):**
```jsonc
{
  "message": "Perfil atualizado com sucesso",
  "user": {
    "id": "uuid",
    "email": "joao@email.com",
    "fullName": "João Silva",
    "phone": "+5511999999999",
    "avatarUrl": "https://...",
    "updatedAt": "2026-06-27T12:00:00.000Z"
  }
}
```
- **Erros:** `400` (validação), `401`.

---

### `PATCH /api/v1/users/me/password`
Troca a senha do usuário. Revoga todos os refresh tokens (força re-login nos outros dispositivos).
- **Auth:** JWT Bearer
- **Body (`ChangePasswordDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `currentPassword` | string | sim | string | `"SenhaAtual@123"` |
| `newPassword` | string | sim | mín. 8; maiúscula, minúscula, número e símbolo (`@$!%*?&`) | `"NovaSenha@456"` |

- **Response (200):**
```jsonc
{ "message": "Senha alterada com sucesso. Faça login novamente." }
```
- **Erros:** `400` (validação), `401` (senha atual incorreta), `404` (usuário não encontrado), `409` (nova senha igual à atual).

---

### `DELETE /api/v1/users/me`
Deleta a conta do usuário de forma **irreversível** (hard delete; cascade remove tudo relacionado).
- **Auth:** JWT Bearer
- **Response (200):**
```jsonc
{ "message": "Conta deletada com sucesso" }
```
- **Erros:** `401`, `404` (usuário não encontrado).

---

### `POST /api/v1/users/me/avatar`
Faz upload da foto de perfil (multipart). Substitui e remove a foto anterior, se existir.
- **Auth:** JWT Bearer
- **Body (`multipart/form-data`):**

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|-----------|
| `avatar` | arquivo (binary) | sim | máx. 5 MB; tipos `jpg`, `jpeg`, `png`, `webp` |

- **Response (200):**
```jsonc
{
  "message": "Foto de perfil atualizada com sucesso",
  "avatarUrl": "https://...",
  "user": {
    "id": "uuid",
    "email": "joao@email.com",
    "fullName": "João Silva",
    "avatarUrl": "https://..."
  }
}
```
- **Erros:** `400` (arquivo ausente, tamanho excedido ou tipo inválido), `401`, `404` (usuário não encontrado).

---

### `DELETE /api/v1/users/me/avatar`
Remove a foto de perfil (deleta do storage e limpa o `avatarUrl`).
- **Auth:** JWT Bearer
- **Response (200):**
```jsonc
{ "message": "Foto de perfil removida com sucesso" }
```
- **Erros:** `401`, `404` (usuário não encontrado), `409` (usuário não possui foto de perfil).

---

### `GET /api/v1/users/admin/list`
Lista usuários com paginação offset e busca por email/nome (Admin).
- **Auth:** JWT Bearer + Role **ADMIN**
- **Query:**

| Campo | Tipo | Obrigatório | Validações / Default |
|-------|------|-------------|----------------------|
| `page` | number | não | default 1 |
| `limit` | number | não | default 10 |
| `search` | string | não | busca em `email` e `fullName` (case-insensitive) |

> Query não passa por DTO/validação — valores chegam como strings e são convertidos no service.
- **Response (200):** _(inferido — validar)_ paginação offset; cada usuário é o registro Prisma cru incluindo `subscription`.
```jsonc
{
  "data": [
    {
      "id": "uuid",
      "email": "joao@email.com",
      "fullName": "João Silva",
      "role": "USER",
      "isActive": true,
      "emailVerified": true,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "subscription": { /* registro de assinatura completo */ }
      // ... demais campos do model User (sem filtro de select)
    }
  ],
  "meta": { "total": 42, "page": 1, "limit": 10, "totalPages": 5 }
}
```
- **Erros:** `401`, `403` (não é ADMIN).

---

### `PATCH /api/v1/users/admin/:id/ban`
Bane/reativa um usuário (Admin). Ao banir, revoga todos os refresh tokens dele.
- **Auth:** JWT Bearer + Role **ADMIN**
- **Path params:**

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|-----------|
| `id` | string | sim | id do usuário |

- **Body (objeto inline, sem DTO):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `isActive` | boolean | sim | `true` reativa, `false` bane | `false` |

> Sem DTO `class-validator`: o body não é validado por whitelist; o service usa `isActive` diretamente.
- **Response (200):**
```jsonc
{ "message": "User banned" }   // ou "User activated" quando isActive=true
```
- **Erros:** `401`, `403` (não é ADMIN).

---

### `PATCH /api/v1/users/admin/:id/role`
Altera o papel (role) de um usuário (Admin).
- **Auth:** JWT Bearer + Role **ADMIN**
- **Path params:**

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|-----------|
| `id` | string | sim | id do usuário |

- **Body (objeto inline, sem DTO):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `role` | string | sim | esperado `USER` \| `ADMIN` \| `SUPER_ADMIN` (não validado no DTO) | `"ADMIN"` |

> Sem DTO `class-validator`: o valor é gravado direto (`role as any`); enviar um valor fora do enum `Role` pode causar erro no banco.
- **Response (200):** _(inferido — validar)_ registro Prisma cru do usuário atualizado (model `User` completo, sem `select`).
- **Erros:** `401`, `403` (não é ADMIN).
