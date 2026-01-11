-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('BUG', 'SUGGESTION', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "release_notes" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "release_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_release_reads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "release_note_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_release_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachments" TEXT[],
    "admin_response" TEXT,
    "admin_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "release_notes_version_key" ON "release_notes"("version");

-- CreateIndex
CREATE UNIQUE INDEX "user_release_reads_user_id_release_note_id_key" ON "user_release_reads"("user_id", "release_note_id");

-- AddForeignKey
ALTER TABLE "user_release_reads" ADD CONSTRAINT "user_release_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_release_reads" ADD CONSTRAINT "user_release_reads_release_note_id_fkey" FOREIGN KEY ("release_note_id") REFERENCES "release_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
