-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "image_key" TEXT,
ADD COLUMN     "image_mime_type" TEXT,
ADD COLUMN     "image_size" INTEGER,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "purchase_links" JSONB;
