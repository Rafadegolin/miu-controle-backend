-- Adiciona o valor WHATSAPP ao enum TransactionSource para marcar transações
-- lançadas via WhatsApp (EvolutionAPI).
-- ATENÇÃO: aplicar ANTES de subir o código que grava source='WHATSAPP'.

-- AlterEnum
ALTER TYPE "TransactionSource" ADD VALUE 'WHATSAPP';
