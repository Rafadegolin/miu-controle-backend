# Importação de Extratos

Convenções globais: ver [README](./README.md).

Importação de extratos bancários em **OFX** ou **CSV**, em duas etapas: `preview` (parseia o arquivo e devolve as transações extraídas, sem salvar) → `confirm` (persiste em lote o que o usuário revisou). As transações criadas têm **`source = IMPORTED`**. Todas as rotas exigem **JWT Bearer**.

> **Limite de arquivo:** 5MB (`413 Payload Too Large` se exceder).
> **Deduplicação:** no `confirm`, transações com a mesma chave `conta + data (YYYY-MM-DD) + valor + tipo + descrição (lowercase/trim)` já existentes na conta — ou repetidas dentro do próprio lote — são ignoradas e contadas em `skipped`.

---

### `POST /api/v1/import/preview`
Lê o arquivo (OFX/CSV) e retorna as transações extraídas para revisão. **NÃO salva nada.**
- **Auth:** JWT Bearer
- **Rate limit:** 20 / min (`@Throttle medium`)
- **Content-Type:** `multipart/form-data`
- **Body (multipart — arquivo `file` + `ImportPreviewDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `file` | file (binary) | Sim | arquivo do extrato; máx. 5MB | (arquivo) |
| `format` | enum `ImportFormat` | Sim | `OFX` \| `CSV` | `"OFX"` |
| `delimiter` | string | Não (CSV) | separador de colunas (default `;`) | `";"` |
| `decimalSeparator` | string | Não (CSV) | separador decimal (default `,`) | `","` |
| `dateFormat` | string | Não (CSV) | `DD/MM/YYYY`\|`DD-MM-YYYY`\|`YYYY-MM-DD`\|`MM/DD/YYYY` | `"DD/MM/YYYY"` |
| `hasHeader` | boolean | Não (CSV) | 1ª linha é cabeçalho (default `true`) | `true` |
| `dateColumn` | string | **Sim se `format=CSV`** | nome do cabeçalho ou índice da coluna | `"Data"` |
| `amountColumn` | string | **Sim se `format=CSV`** | nome ou índice | `"Valor"` |
| `descriptionColumn` | string | **Sim se `format=CSV`** | nome ou índice | `"Descrição"` |
| `typeColumn` | string | Não (CSV) | coluna C/D; se ausente, infere o tipo pelo sinal do valor | `"Tipo"` |

- **Response (200):**
```jsonc
{
  "format": "OFX",
  "count": 42,
  "summary": {
    "totalIncome": 5000,        // soma dos INCOME
    "totalExpense": 3200,       // soma dos EXPENSE (valor positivo)
    "net": 1800,                // totalIncome - totalExpense
    "firstDate": "2026-01-02",  // data do 1º item (ou null)
    "lastDate": "2026-01-31"    // data do último item (ou null)
  },
  "transactions": [             // itens ParsedTransactionDto (ver shape abaixo)
    {
      "date": "2026-01-15",
      "amount": 89.5,           // sempre positivo; o tipo define o sinal
      "type": "EXPENSE",        // INCOME | EXPENSE
      "description": "Compra Supermercado Extra",
      "externalId": "FITID-202401150001"  // opcional (ex.: FITID do OFX)
    }
  ]
}
```
- **Erros:** `400` arquivo ausente / falha ao parsear (formato inválido, coluna não encontrada) / colunas CSV obrigatórias faltando · `413` arquivo > 5MB · `429` limite excedido.

---

### `POST /api/v1/import/confirm`
Persiste em lote as transações revisadas (`source = IMPORTED`, `status = COMPLETED`), pulando duplicatas e atualizando o saldo da conta uma única vez com o delta líquido. Emite `balance.updated`.
- **Auth:** JWT Bearer
- **Rate limit:** 20 / min (`@Throttle medium`)
- **Body (`ConfirmImportDto`):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `accountId` | string | Sim | não-vazio; conta de destino deve existir e ser do usuário | `"uuid-da-conta"` |
| `transactions` | `ParsedTransactionDto[]` | Sim | array com ≥ 1 item; cada item validado | ver abaixo |

**`ParsedTransactionDto` (item):**

| Campo | Tipo | Obrigatório | Validações | Exemplo |
|-------|------|-------------|------------|---------|
| `date` | string (ISO date) | Sim | ISO 8601 | `"2026-01-15"` |
| `amount` | number | Sim | ≥ 0.01 (sempre positivo; o tipo define o sinal) | `89.5` |
| `type` | enum `TransactionType` | Sim | `INCOME` \| `EXPENSE` | `"EXPENSE"` |
| `description` | string | Sim | — | `"Compra Supermercado Extra"` |
| `externalId` | string | Não | id externo (ex.: FITID do OFX) para deduplicação | `"FITID-202401150001"` |

- **Response (201):**
```jsonc
{ "imported": 40, "skipped": 2 }
```
Quando nada novo é importado, vem com uma mensagem extra:
```jsonc
{ "imported": 0, "skipped": 2, "message": "Nenhuma transação nova para importar." }
```
- **Erros:** `400` validação (array vazio, campo inválido) · `403` conta não pertence ao usuário · `404` conta não encontrada · `429` limite excedido.
