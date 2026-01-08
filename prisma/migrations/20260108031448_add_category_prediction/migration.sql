-- CreateTable
CREATE TABLE "category_predictions" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "predicted" DECIMAL(15,2) NOT NULL,
    "actual" DECIMAL(15,2),
    "confidence" DECIMAL(5,2) NOT NULL,
    "lower_bound" DECIMAL(15,2),
    "upper_bound" DECIMAL(15,2),
    "factors" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_predictions_user_id_month_idx" ON "category_predictions"("user_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "category_predictions_user_id_category_id_month_key" ON "category_predictions"("user_id", "category_id", "month");

-- AddForeignKey
ALTER TABLE "category_predictions" ADD CONSTRAINT "category_predictions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_predictions" ADD CONSTRAINT "category_predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
