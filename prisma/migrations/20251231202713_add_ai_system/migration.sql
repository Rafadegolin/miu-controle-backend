-- CreateEnum
CREATE TYPE "AiFeatureType" AS ENUM ('CATEGORIZATION', 'OCR', 'BANK_NOTIFICATION', 'ASSISTANT');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "ai_categorized" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_ai_training_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_ai_configs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "openai_api_key_encrypted" TEXT NOT NULL,
    "is_ai_enabled" BOOLEAN NOT NULL DEFAULT true,
    "monthly_token_limit" INTEGER DEFAULT 1000000,
    "preferred_model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "last_tested_at" TIMESTAMP(3),
    "is_key_valid" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_metrics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "feature" "AiFeatureType" NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "estimated_cost" DECIMAL(10,6) NOT NULL,
    "related_entity_id" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_categorization_feedbacks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "original_category_id" TEXT,
    "corrected_category_id" TEXT NOT NULL,
    "ai_confidence" DECIMAL(3,2) NOT NULL,
    "was_correct" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_categorization_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_ai_configs_user_id_key" ON "user_ai_configs"("user_id");

-- CreateIndex
CREATE INDEX "ai_usage_metrics_user_id_timestamp_idx" ON "ai_usage_metrics"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "ai_usage_metrics_user_id_feature_idx" ON "ai_usage_metrics"("user_id", "feature");

-- CreateIndex
CREATE UNIQUE INDEX "ai_categorization_feedbacks_transaction_id_key" ON "ai_categorization_feedbacks"("transaction_id");

-- CreateIndex
CREATE INDEX "ai_categorization_feedbacks_user_id_idx" ON "ai_categorization_feedbacks"("user_id");

-- AddForeignKey
ALTER TABLE "user_ai_configs" ADD CONSTRAINT "user_ai_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_metrics" ADD CONSTRAINT "ai_usage_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_categorization_feedbacks" ADD CONSTRAINT "ai_categorization_feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_categorization_feedbacks" ADD CONSTRAINT "ai_categorization_feedbacks_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_categorization_feedbacks" ADD CONSTRAINT "ai_categorization_feedbacks_original_category_id_fkey" FOREIGN KEY ("original_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_categorization_feedbacks" ADD CONSTRAINT "ai_categorization_feedbacks_corrected_category_id_fkey" FOREIGN KEY ("corrected_category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
