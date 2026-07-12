-- Adiciona o valor RECURRING ao enum TransactionSource para distinguir
-- transações geradas automaticamente por recorrência das lançadas manualmente.
-- ATENÇÃO: aplicar esta migração ANTES de subir o código que grava
-- `source: 'RECURRING'` (o valor precisa existir no banco primeiro).

-- AlterEnum
ALTER TYPE "TransactionSource" ADD VALUE 'RECURRING';
