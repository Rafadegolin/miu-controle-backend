-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'FAMILY');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('EXPENSE', 'INCOME', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'NOTIFICATION', 'OPEN_BANKING', 'IMPORTED');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('MONTHLY', 'WEEKLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RuleConditionType" AS ENUM ('CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'REGEX');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'TRIALING');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'DUPLICATE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "subscription_tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "bank_code" TEXT,
    "initial_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "open_banking_connected" BOOLEAN NOT NULL DEFAULT false,
    "open_banking_consent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "type" "CategoryType" NOT NULL,
    "parent_id" TEXT,
    "color" TEXT NOT NULL DEFAULT '#94A3B8',
    "icon" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "budget_allocated" DECIMAL(15,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "category_id" TEXT,
    "type" "CategoryType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "description" TEXT NOT NULL,
    "merchant" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_pattern" TEXT,
    "tags" TEXT[],
    "notes" TEXT,
    "location" JSONB,
    "receipt_url" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "source" "TransactionSource" NOT NULL DEFAULT 'MANUAL',
    "notification_hash" TEXT,
    "ai_confidence" DECIMAL(3,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "period" "BudgetPeriod" NOT NULL DEFAULT 'MONTHLY',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "alert_percentage" INTEGER NOT NULL DEFAULT 80,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target_amount" DECIMAL(15,2) NOT NULL,
    "current_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "target_date" TIMESTAMP(3),
    "color" TEXT NOT NULL DEFAULT '#10B981',
    "icon" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_contributions" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "transaction_id" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorization_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "condition_type" "RuleConditionType" NOT NULL,
    "condition_value" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "match_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" "SubscriptionTier" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "payment_provider" TEXT NOT NULL DEFAULT 'ABACATEPAY',
    "external_subscription_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "billing_cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_hash" TEXT NOT NULL,
    "raw_content" TEXT NOT NULL,
    "parsed_data" JSONB,
    "bank_detected" TEXT,
    "amount_detected" DECIMAL(15,2),
    "transaction_id" TEXT,
    "processing_status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_user_id_is_active_idx" ON "accounts"("user_id", "is_active");

-- CreateIndex
CREATE INDEX "categories_user_id_type_idx" ON "categories"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_notification_hash_key" ON "transactions"("notification_hash");

-- CreateIndex
CREATE INDEX "transactions_user_id_date_idx" ON "transactions"("user_id", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_account_id_idx" ON "transactions"("account_id");

-- CreateIndex
CREATE INDEX "transactions_category_id_idx" ON "transactions"("category_id");

-- CreateIndex
CREATE INDEX "budgets_user_id_period_start_date_idx" ON "budgets"("user_id", "period", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_user_id_category_id_period_start_date_key" ON "budgets"("user_id", "category_id", "period", "start_date");

-- CreateIndex
CREATE INDEX "goals_user_id_status_idx" ON "goals"("user_id", "status");

-- CreateIndex
CREATE INDEX "categorization_rules_user_id_is_active_priority_idx" ON "categorization_rules"("user_id", "is_active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "user_subscriptions_user_id_key" ON "user_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "user_subscriptions_status_idx" ON "user_subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_notification_hash_key" ON "notification_logs"("notification_hash");

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_transaction_id_key" ON "notification_logs"("transaction_id");

-- CreateIndex
CREATE INDEX "notification_logs_user_id_received_at_idx" ON "notification_logs"("user_id", "received_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
