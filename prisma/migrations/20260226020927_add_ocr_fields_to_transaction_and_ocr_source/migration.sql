-- AlterEnum
ALTER TYPE "TransactionSource" ADD VALUE 'OCR';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "receipt_image_url" TEXT,
ADD COLUMN     "receipt_items" JSONB,
ADD COLUMN     "receipt_raw_text" TEXT;
