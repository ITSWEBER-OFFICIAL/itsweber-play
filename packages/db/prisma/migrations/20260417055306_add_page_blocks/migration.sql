-- CreateEnum
CREATE TYPE "PageBlockType" AS ENUM ('HERO', 'VIDEO_GRID', 'CATEGORY_CHIPS', 'CTA_BANNER');

-- CreateTable
CREATE TABLE "PageBlock" (
    "id" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL DEFAULT 'home',
    "position" INTEGER NOT NULL,
    "type" "PageBlockType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageBlock_pageSlug_position_idx" ON "PageBlock"("pageSlug", "position");
