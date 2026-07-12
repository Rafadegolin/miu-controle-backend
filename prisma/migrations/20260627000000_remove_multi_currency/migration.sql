-- Remoção do suporte a multi-moeda (currencies + exchange_rates).
-- Os campos string `currency`/`preferred_currency` em accounts/users permanecem
-- (default 'BRL') — não dependem destas tabelas, então nada mais é alterado.

-- DropForeignKey
ALTER TABLE "exchange_rates" DROP CONSTRAINT "exchange_rates_from_currency_id_fkey";

-- DropForeignKey
ALTER TABLE "exchange_rates" DROP CONSTRAINT "exchange_rates_to_currency_id_fkey";

-- DropTable
DROP TABLE "currencies";

-- DropTable
DROP TABLE "exchange_rates";
