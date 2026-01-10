-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('REDUCE_EXPENSE', 'OPTIMIZE_BUDGET', 'SAVINGS_OPPORTUNITY', 'RISK_ALERT', 'SUBSCRIPTION_REVIEW');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('ACTIVE', 'APPLIED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AlertPriority" AS ENUM ('CRITICAL', 'WARNING', 'INFO', 'POSITIVE');

-- AlterEnum
ALTER TYPE "AiFeatureType" ADD VALUE 'RECOMMENDATIONS';

-- AlterTable
ALTER TABLE "emergency_funds" ADD COLUMN     "recommendation" TEXT;

-- AlterTable
ALTER TABLE "user_ai_configs" ADD COLUMN     "recommendation_model" TEXT NOT NULL DEFAULT 'gpt-4o-mini';

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" DOUBLE PRECISION NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
    "applied_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proactive_alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" "AlertPriority" NOT NULL,
    "message" TEXT NOT NULL,
    "ai_insight" TEXT,
    "actionable" BOOLEAN NOT NULL DEFAULT false,
    "action_url" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proactive_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendations_user_id_status_idx" ON "recommendations"("user_id", "status");

-- CreateIndex
CREATE INDEX "recommendations_user_id_priority_idx" ON "recommendations"("user_id", "priority" DESC);

-- CreateIndex
CREATE INDEX "proactive_alerts_user_id_dismissed_idx" ON "proactive_alerts"("user_id", "dismissed");

-- CreateIndex
CREATE INDEX "proactive_alerts_user_id_priority_idx" ON "proactive_alerts"("user_id", "priority");

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proactive_alerts" ADD CONSTRAINT "proactive_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
