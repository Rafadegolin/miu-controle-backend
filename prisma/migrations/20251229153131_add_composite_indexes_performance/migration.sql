-- CreateIndex
CREATE INDEX "budgets_user_id_period_start_date_end_date_idx" ON "budgets"("user_id", "period", "start_date" DESC, "end_date" DESC);

-- CreateIndex
CREATE INDEX "goals_user_id_status_created_at_idx" ON "goals"("user_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "transactions_user_id_date_type_idx" ON "transactions"("user_id", "date" DESC, "type");

-- CreateIndex
CREATE INDEX "transactions_account_id_status_date_idx" ON "transactions"("account_id", "status", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_category_id_date_idx" ON "transactions"("category_id", "date" DESC);

-- CreateIndex
CREATE INDEX "transactions_user_id_source_created_at_idx" ON "transactions"("user_id", "source", "created_at" DESC);
