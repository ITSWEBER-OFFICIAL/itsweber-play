-- CreateEnum
CREATE TYPE "VideoFormat" AS ENUM ('LONG', 'SHORT');

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "format" "VideoFormat" NOT NULL DEFAULT 'LONG';

-- CreateIndex
CREATE INDEX "Video_format_visibility_status_publishedAt_idx" ON "Video"("format", "visibility", "status", "publishedAt");
