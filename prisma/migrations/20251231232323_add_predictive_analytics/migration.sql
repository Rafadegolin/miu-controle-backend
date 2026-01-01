/*
  Warnings:

  - You are about to drop the column `preferred_model` on the `user_ai_configs` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AiFeatureType" ADD VALUE 'PREDICTIVE_ANALYTICS';
ALTER TYPE "AiFeatureType" ADD VALUE 'ANOMALY_DETECTION';

-- AlterTable
ALTER TABLE "user_ai_configs" DROP COLUMN "preferred_model",
ADD COLUMN     "analytics_model" TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
ADD COLUMN     "categorization_model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
ADD COLUMN     "gemini_api_key_encrypted" TEXT,
ADD COLUMN     "uses_corporate_key" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "openai_api_key_encrypted" DROP NOT NULL;

-- CreateTable
CREATE TABLE "prediction_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "prediction_type" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "predicted_income" DECIMAL(15,2),
    "predicted_expenses" DECIMAL(15,2),
    "predicted_balance" DECIMAL(15,2),
    "confidence" DECIMAL(3,2) NOT NULL,
    "category_breakdown" JSONB,
    "algorithm" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anomaly_detections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "anomaly_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "anomaly_score" DECIMAL(3,2) NOT NULL,
    "description" TEXT NOT NULL,
    "expected_value" DECIMAL(15,2),
    "actual_value" DECIMAL(15,2),
    "deviation" DECIMAL(15,2),
    "historical_average" DECIMAL(15,2),
    "historical_std_dev" DECIMAL(15,2),
    "ai_analysis" TEXT,
    "is_notified" BOOLEAN NOT NULL DEFAULT false,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissed_at" TIMESTAMP(3),
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomaly_detections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prediction_history_user_id_prediction_type_created_at_idx" ON "prediction_history"("user_id", "prediction_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "anomaly_detections_user_id_severity_is_dismissed_idx" ON "anomaly_detections"("user_id", "severity", "is_dismissed");

-- CreateIndex
CREATE INDEX "anomaly_detections_user_id_detected_at_idx" ON "anomaly_detections"("user_id", "detected_at" DESC);

-- AddForeignKey
ALTER TABLE "prediction_history" ADD CONSTRAINT "prediction_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_detections" ADD CONSTRAINT "anomaly_detections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anomaly_detections" ADD CONSTRAINT "anomaly_detections_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
