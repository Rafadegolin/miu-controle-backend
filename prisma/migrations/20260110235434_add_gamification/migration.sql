/*
  Warnings:

  - You are about to drop the column `created_at` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `email_verified` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `last_login_at` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `subscription_tier` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `two_factor_enabled` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "MissionFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'ONEOFF', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'FAILED');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "created_at",
DROP COLUMN "email_verified",
DROP COLUMN "last_login_at",
DROP COLUMN "subscription_tier",
DROP COLUMN "two_factor_enabled",
DROP COLUMN "updated_at",
ADD COLUMN     "current_xp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "education_level" TEXT,
ADD COLUMN     "last_activity_date" TIMESTAMP(3),
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "streak_current" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "streak_longest" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "xp_reward" INTEGER NOT NULL,
    "frequency" "MissionFrequency" NOT NULL,
    "criteria" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_missions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "status" "MissionStatus" NOT NULL DEFAULT 'ACTIVE',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL DEFAULT 1,
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_missions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "missions_code_key" ON "missions"("code");

-- CreateIndex
CREATE INDEX "user_missions_user_id_status_idx" ON "user_missions"("user_id", "status");

-- AddForeignKey
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_missions" ADD CONSTRAINT "user_missions_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
