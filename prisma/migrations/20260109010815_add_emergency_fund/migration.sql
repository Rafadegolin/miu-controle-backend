-- CreateTable
CREATE TABLE "emergency_funds" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "target_amount" DECIMAL(15,2) NOT NULL,
    "current_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "months_covered" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "monthly_contribution" DECIMAL(15,2),
    "linked_goal_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_fund_withdrawals" (
    "id" TEXT NOT NULL,
    "fund_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_fund_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emergency_funds_user_id_key" ON "emergency_funds"("user_id");

-- AddForeignKey
ALTER TABLE "emergency_funds" ADD CONSTRAINT "emergency_funds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_funds" ADD CONSTRAINT "emergency_funds_linked_goal_id_fkey" FOREIGN KEY ("linked_goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_fund_withdrawals" ADD CONSTRAINT "emergency_fund_withdrawals_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "emergency_funds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
