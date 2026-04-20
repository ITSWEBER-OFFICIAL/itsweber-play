-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "about" TEXT,
ADD COLUMN     "avatarAssetKey" TEXT,
ADD COLUMN     "bannerAssetKey" TEXT,
ADD COLUMN     "socialLinks" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "chapters" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "commentsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "thumbnailCandidates" TEXT[] DEFAULT ARRAY[]::TEXT[];
