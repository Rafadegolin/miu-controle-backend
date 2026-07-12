# WhatsApp

Convenções globais: ver [README](./README.md).

Integração de lançamento de transações por mensagem de WhatsApp via **EvolutionAPI** (cliente não-oficial baseado em Baileys). A EvolutionAPI chama um **webhook público** a cada mensagem recebida; o backend identifica o usuário pelo telefone, interpreta a mensagem em linguagem natural, cria a transação (`source = WHATSAPP`) e responde no próprio WhatsApp.

> Este é um endpoint de **integração** (não consumido pelo frontend). Está oculto no Swagger (`@ApiExcludeEndpoint`).

---

### `POST /api/v1/whatsapp/webhook`
Recebe eventos da EvolutionAPI e processa mensagens recebidas. **O versionamento se aplica** — o caminho é `/api/v1/whatsapp/webhook` (não `/api/whatsapp/...`).
- **Auth:** Público (sem JWT). Validado por **token compartilhado**: header `apikey` **ou** query `?token=`, ambos comparados com a env `EVOLUTION_WEBHOOK_TOKEN`. Se a env não estiver configurada, o webhook é aceito **sem validação** (apenas loga um aviso).
- **Content-Type:** `application/json`
- **Query / Headers (autenticação):**

| Local | Campo | Tipo | Obrigatório | Descrição |
|-------|-------|------|-------------|-----------|
| Header | `apikey` | string | Um dos dois* | Token; deve igualar `EVOLUTION_WEBHOOK_TOKEN` |
| Query | `token` | string | Um dos dois* | Alternativa ao header `apikey` |

\* Quando `EVOLUTION_WEBHOOK_TOKEN` está setado, pelo menos um deve bater; senão → `401`. Quando a env **não** está setada, nenhum é exigido.

- **Body (payload da EvolutionAPI — `any`, validado de forma tolerante):** estrutura esperada do evento `messages.upsert`:
```jsonc
{
  "event": "messages.upsert",   // só eventos cujo nome contém "messages" são processados; outros retornam { received, ignored }
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",  // telefone do remetente (@g.us = grupo, ignorado)
      "fromMe": false                               // mensagens nossas são ignoradas
    },
    "message": {
      "conversation": "mercado 50"                  // OU message.extendedTextMessage.text
    }
  }
}
```

- **Comportamento:**
  1. Ignora mensagens sem `remoteJid`, de grupos (`@g.us`) ou enviadas por nós (`fromMe`).
  2. Extrai o texto de `data.message.conversation` (ou `data.message.extendedTextMessage.text`).
  3. Identifica o usuário pelo telefone do `remoteJid` (compara os últimos 8 dígitos com `User.phone`); se não achar, responde orientando a cadastrar o telefone no app.
  4. **Parseia a mensagem livre** (ver regras abaixo). Se não reconhecer um valor, responde com exemplos de uso.
  5. Usa a conta ativa mais antiga do usuário (`isActive`, `createdAt asc`); se não houver conta, orienta a criar uma.
  6. Cria a transação com `source = WHATSAPP` (passa pelo fluxo normal de `create`: detecção de marca, categorização IA, atualização de saldo, eventos WebSocket).
  7. Responde no WhatsApp confirmando (ex.: `✅ Despesa registrada: R$ 50,00 — mercado (Alimentação)`) ou, em caso de falha, pede para tentar de novo.

- **Parsing da mensagem** (`parseWhatsappMessage`):
  - **Tipo:** sinal `+` no início → `INCOME`; `-` → `EXPENSE`; senão, palavras-chave de receita (`recebi`, `salário`, `entrada`, `ganhei`, `receita`, `rendimento`, `reembolso`, ...) → `INCOME`; padrão → `EXPENSE`.
  - **Valor:** primeiro número monetário do texto (aceita `R$`, milhar com ponto e decimal vírgula/ponto). Sem valor reconhecível → mensagem não processada.
  - **Descrição:** o texto restante (sem o valor e sem sinais iniciais); se ficar vazia → `"Lançamento via WhatsApp"`.
  - Exemplos: `"mercado 50"`, `"uber 25,90"`, `"+2000 salário"`, `"-12,50 café"`.

- **Response (200):** sempre `200 OK` para a Evolution (mesmo quando a mensagem é ignorada):
```jsonc
{ "received": true }
// quando o evento não é de mensagem:
{ "received": true, "ignored": "<nome-do-evento>" }
```
- **Erros:** `401` token de webhook inválido (quando `EVOLUTION_WEBHOOK_TOKEN` está configurado e nenhum token bate). Erros de negócio (usuário/conta não encontrados, falha ao registrar) **não** retornam erro HTTP — são respondidos como mensagem no WhatsApp.

---

## Variáveis de ambiente

| Env | Obrigatória | Descrição |
|-----|-------------|-----------|
| `EVOLUTION_API_URL` | Para envio | URL base da instância EvolutionAPI |
| `EVOLUTION_API_KEY` | Para envio | API key da EvolutionAPI (enviada no header `apikey` ao chamar a Evolution) |
| `EVOLUTION_INSTANCE` | Para envio | Nome da instância (usado em `/message/sendText/<instance>`) |
| `EVOLUTION_WEBHOOK_TOKEN` | Recomendada | Token que valida os webhooks recebidos (header `apikey` ou query `?token=`). Se ausente, o webhook é aceito sem validação |

> Se `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE` não estiverem todas configuradas, o envio de mensagens vira no-op (apenas loga) — o webhook ainda processa e cria transações, mas não responde no WhatsApp.
