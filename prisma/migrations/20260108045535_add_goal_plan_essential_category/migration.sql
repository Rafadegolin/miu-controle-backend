-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "is_essential" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "goal_plans" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "monthly_deposit" DECIMAL(15,2) NOT NULL,
    "is_viable" BOOLEAN NOT NULL,
    "action_plan" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "goal_plans_goal_id_key" ON "goal_plans"("goal_id");

-- AddForeignKey
ALTER TABLE "goal_plans" ADD CONSTRAINT "goal_plans_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
