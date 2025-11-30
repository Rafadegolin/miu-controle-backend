-- Criar o novo enum TransactionType se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransactionType') THEN
        CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');
    END IF;
END $$;

-- Adicionar coluna temporária com o novo tipo
ALTER TABLE "transactions" ADD COLUMN "type_new" "TransactionType";

-- Copiar dados convertendo CategoryType para TransactionType
-- INCOME -> INCOME
-- EXPENSE -> EXPENSE  
-- TRANSFER -> EXPENSE (ou você pode escolher outra lógica)
UPDATE "transactions"
SET "type_new" = 
    CASE 
        WHEN "type" = 'INCOME'::"CategoryType" THEN 'INCOME'::"TransactionType"
        WHEN "type" = 'EXPENSE'::"CategoryType" THEN 'EXPENSE'::"TransactionType"
        WHEN "type" = 'TRANSFER'::"CategoryType" THEN 'EXPENSE'::"TransactionType"
    END;

-- Remover a coluna antiga
ALTER TABLE "transactions" DROP COLUMN "type";

-- Renomear a coluna nova para 'type'
ALTER TABLE "transactions" RENAME COLUMN "type_new" TO "type";

-- Tornar a coluna NOT NULL
ALTER TABLE "transactions" ALTER COLUMN "type" SET NOT NULL;
