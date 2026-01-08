-- CreateEnum
CREATE TYPE "GoalDistributionStrategy" AS ENUM ('PROPORTIONAL', 'SEQUENTIAL', 'PRIORITY', 'MANUAL');

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "distribution_strategy" "GoalDistributionStrategy" NOT NULL DEFAULT 'PROPORTIONAL',
ADD COLUMN     "hierarchy_level" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "is_blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "goals_parent_id_idx" ON "goals"("parent_id");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
