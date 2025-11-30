-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "device_info" TEXT,
ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "user_agent" TEXT;
