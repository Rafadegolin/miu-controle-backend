# Autenticação

Convenções globais: ver [README](./README.md).

Autenticação nativa (JWT email/senha), troca de sessão OAuth (Google/Apple via Better Auth),
verificação/reset de senha e gestão de sessões/dispositivos.

> **Roteamento:** todas as rotas nativas abaixo ficam sob **`/api/v1/auth/*`**.
> O fluxo OAuth do Better Auth (`/api/auth/signin/*`, `/api/auth/callback/*`) vive em
> **`/api/auth/*` SEM `v1`** — ver [Fluxo OAuth](#fluxo-oauth-google--apple-better-auth).

---

### `POST /api/v1/auth/register`
Cria uma nova conta (email/senha) e dispara o email de verificação automaticamente.
- **Auth:** Público
- **Rate limit:** 3 / hora (tier `long`)
- **Body (`RegisterDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `fullName` | string | sim | 3–255 caracteres | `"João Silva"` |
| `email` | string | sim | email válido | `"joao@email.com"` |
| `password` | string | sim | mín. 8; deve conter maiúscula, minúscula, número e símbolo (`@$!%*?&`) | `"SenhaForte@123"` |

- **Response (201):**
```jsonc
{
  "user": {
    "id": "uuid",
    "email": "joao@email.com",
    "fullName": "João Silva",
    "emailVerified": false,
    "createdAt": "2026-06-27T12:00:00.000Z",
    "subscription": { "plan": "FREE" },
    "subscriptionTier": "FREE"
  },
  "accessToken": "jwt...",
  "refreshToken": "jwt...",
  "message": "Conta criada! Verifique seu email para ativar."
}
```
- **Erros:** `400` (validação), `409` (email já cadastrado).

---

### `POST /api/v1/auth/login`
Autentica por email/senha e retorna os tokens JWT.
- **Auth:** Público
- **Rate limit:** 5 / min (tier `short`)
- **Body (`LoginDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `email` | string | sim | email válido | `"joao@email.com"` |
| `password` | string | sim | string | `"SenhaForte@123"` |

- **Response (200):**
```jsonc
{
  "user": {
    "id": "uuid",
    "email": "joao@email.com",
    "fullName": "João Silva",
    "subscriptionTier": "FREE"
  },
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```
- **Erros:** `401` (credenciais inválidas; conta desativada/banida; ou conta criada via login social — sem senha → orienta usar "Entrar com Google").

---

### `POST /api/v1/auth/google/exchange`
Troca uma sessão do Better Auth (pós-OAuth Google) pelos tokens JWT nativos. Provisiona o usuário no primeiro acesso.
- **Auth:** Público (valida o `sessionToken` do Better Auth)
- **Rate limit:** 10 / min (tier `short`)
- **Body (`GoogleExchangeDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `sessionToken` | string | sim | obrigatório (sem ele → 401) | `"abc123..."` |

- **Response (200):**
```jsonc
{
  "user": {
    "id": "uuid",
    "email": "joao@email.com",
    "fullName": "João Silva",
    "avatarUrl": "https://...",   // pode ser null
    "subscriptionTier": "FREE",
    "hasCompletedOnboarding": false
  },
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```
- **Erros:** `401` (`sessionToken` ausente, ou sessão Google inválida/expirada, ou conta desativada/banida).

---

### `POST /api/v1/auth/apple/exchange`
Troca uma sessão do Better Auth (pós Apple Sign-In) pelos tokens JWT nativos. Obrigatório para publicação na App Store. Provisiona o usuário no primeiro acesso.
- **Auth:** Público (valida o `sessionToken` do Better Auth)
- **Rate limit:** 10 / min (tier `short`)
- **Body (`AppleExchangeDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `sessionToken` | string | sim | obrigatório (sem ele → 401) | `"abc123..."` |

- **Response (200):** idêntico ao `/google/exchange` (objeto `user` com `avatarUrl` + `hasCompletedOnboarding`, `accessToken`, `refreshToken`).
> Observação: a Apple só envia o nome do usuário no **primeiro** login; em logins seguintes o `fullName` provém do registro já existente.
- **Erros:** `401` (`sessionToken` ausente, ou sessão Apple inválida/expirada, ou conta desativada/banida).

---

### `POST /api/v1/auth/refresh`
Renova o par de tokens a partir de um refresh token válido.
- **Auth:** Público (valida o refresh token no corpo)
- **Body (`RefreshTokenDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `refreshToken` | string | sim | não vazio | `"jwt..."` |

- **Response (200):**
```jsonc
{ "accessToken": "jwt...", "refreshToken": "jwt..." }
```
- **Erros:** `400` (refresh token ausente/inválido como string), `401` (token inválido, revogado, expirado, ou usuário não encontrado).

---

### `GET /api/v1/auth/me`
Retorna os dados do usuário autenticado (extraídos do JWT/banco).
- **Auth:** JWT Bearer
- **Response (200):**
```jsonc
{
  "id": "uuid",
  "email": "joao@email.com",
  "fullName": "João Silva",
  "role": "USER",
  "subscription": { "plan": "FREE" },
  "subscriptionTier": "FREE"
}
```
- **Erros:** `401` (token ausente/inválido/expirado, ou usuário não existe mais).

---

### `POST /api/v1/auth/forgot-password`
Solicita recuperação de senha. Sempre responde 200 (não revela se o email existe).
- **Auth:** Público
- **Rate limit:** 3 / hora (tier `long`)
- **Body (`ForgotPasswordDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `email` | string | sim | email válido | `"joao@email.com"` |

- **Response (200):**
```jsonc
{ "message": "Se o email existir, você receberá instruções para redefinir sua senha." }
```
- **Erros:** `400` (validação).

---

### `POST /api/v1/auth/verify-reset-token`
Valida se um token de reset de senha está ativo (não usado e não expirado).
- **Auth:** Público
- **Body (`VerifyResetTokenDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `token` | string | sim | string | `"a1b2c3..."` |

- **Response (200):**
```jsonc
{ "valid": true, "email": "joao@email.com" }
```
- **Erros:** `400` (token inválido, já utilizado ou expirado).

---

### `POST /api/v1/auth/reset-password`
Redefine a senha usando um token válido. Revoga todos os refresh tokens (força re-login).
- **Auth:** Público
- **Body (`ResetPasswordDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `token` | string | sim | string | `"a1b2c3..."` |
| `newPassword` | string | sim | mín. 8; maiúscula, minúscula, número e símbolo (`@$!%*?&`) | `"NovaSenha@123"` |

- **Response (200):**
```jsonc
{ "message": "Senha alterada com sucesso! Faça login novamente." }
```
- **Erros:** `400` (token inválido/usado/expirado, ou validação da senha), `409` (nova senha igual à atual).

---

### `POST /api/v1/auth/verify-email`
Confirma o email do usuário com o token recebido por email.
- **Auth:** Público
- **Rate limit:** `@SkipThrottle` (sem limite)
- **Body (`VerifyEmailDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `token` | string | sim | string | `"a1b2c3..."` |

- **Response (200):**
```jsonc
{ "message": "Email verificado com sucesso! 🎉", "emailVerified": true }
```
- **Erros:** `400` (token inválido/usado/expirado), `409` (email já verificado).

---

### `POST /api/v1/auth/resend-verification`
Reenvia o email de verificação. Sempre responde 200 quando o email não existe (não revela existência).
- **Auth:** Público
- **Rate limit:** 3 / hora (tier `long`)
- **Body (`ResendVerificationDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|-----------|---------|
| `email` | string | sim | email válido | `"joao@email.com"` |

- **Response (200):**
```jsonc
{ "message": "Se o email existir e não estiver verificado, enviaremos um novo link." }
```
- **Erros:** `400` (validação), `409` (email já verificado).

---

### `GET /api/v1/auth/sessions`
Lista as sessões (dispositivos) ativas do usuário; marca a sessão atual.
- **Auth:** JWT Bearer
- **Response (200):** array de sessões.
```jsonc
[
  {
    "id": "uuid",
    "deviceInfo": "Chrome em Windows",   // "Dispositivo Desconhecido" se nulo
    "ipAddress": "187.0.0.1",            // "IP Desconhecido" se nulo
    "lastUsedAt": "2026-06-27T12:00:00.000Z",
    "createdAt": "2026-06-20T08:00:00.000Z",
    "expiresAt": "2026-06-27T08:00:00.000Z",
    "isCurrent": true
  }
]
```
- **Erros:** `401`.

---

### `DELETE /api/v1/auth/sessions/:id`
Revoga uma sessão específica. Não permite revogar a sessão atual.
- **Auth:** JWT Bearer
- **Path params:**

| Campo | Tipo | Obrigatório | Validações |
|-------|------|-------------|-----------|
| `id` | string | sim | id da sessão (refresh token) |

- **Response (200):**
```jsonc
{ "message": "Sessão revogada com sucesso" }
```
- **Erros:** `401`, `403` (sessão de outro usuário, ou tentativa de revogar a sessão atual), `404` (sessão não encontrada).

---

### `DELETE /api/v1/auth/sessions/revoke-all`
Revoga todas as sessões exceto a atual.
- **Auth:** JWT Bearer
- **Response (200):**
```jsonc
{ "message": "2 sessão(ões) revogada(s) com sucesso", "count": 2 }
```
- **Erros:** `401`.

---

## Fluxo OAuth Google / Apple (Better Auth)

Rotas **não versionadas**, sob `/api/auth/*`, geridas por middleware do Better Auth
(ver [README → Autenticação](./README.md#autenticação)):

1. Frontend redireciona para `GET /api/auth/signin/google` (ou `/api/auth/signin/apple`).
2. Após o consentimento e o callback (`/api/auth/callback/{provider}`), o Better Auth cria uma sessão e redireciona o frontend com um `sessionToken`.
3. Frontend troca a sessão por tokens nativos: `POST /api/v1/auth/google/exchange` (ou `/apple/exchange`) com `{ sessionToken }` → retorna o **mesmo formato do login** (`user` + `accessToken` + `refreshToken`).
4. A partir daí, usa-se o JWT nativo normalmente (`Authorization: Bearer <accessToken>`).
