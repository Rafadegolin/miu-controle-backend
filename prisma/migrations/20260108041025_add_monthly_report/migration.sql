-- CreateTable
CREATE TABLE "monthly_reports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "total_income" DECIMAL(15,2) NOT NULL,
    "total_expense" DECIMAL(15,2) NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL,
    "savings_rate" DECIMAL(5,2) NOT NULL,
    "topCategories" JSONB NOT NULL,
    "anomalies" JSONB NOT NULL,
    "trends" JSONB NOT NULL,
    "insights" JSONB NOT NULL,
    "comparisonPrev" JSONB NOT NULL,
    "comparisonAvg" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_reports_user_id_month_idx" ON "monthly_reports"("user_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_reports_user_id_month_key" ON "monthly_reports"("user_id", "month");

-- AddForeignKey
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
