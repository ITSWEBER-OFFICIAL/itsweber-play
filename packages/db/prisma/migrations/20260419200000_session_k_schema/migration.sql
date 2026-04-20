-- A11y + Social + Community Posts + Direct Messages + Scheduled Publish

-- New enums
CREATE TYPE "ReactionKind" AS ENUM ('LIKE', 'FIRE', 'LOL', 'WOW', 'SAD');
CREATE TYPE "DmPermission" AS ENUM ('ALL', 'SUBSCRIBERS_ONLY', 'NONE');

-- PageBlockType: add COMMUNITY_ROW (additive)
ALTER TYPE "PageBlockType" ADD VALUE IF NOT EXISTS 'COMMUNITY_ROW';

-- Reaction: add kind column (non-breaking, default LIKE)
ALTER TABLE "Reaction" ADD COLUMN IF NOT EXISTS "kind" "ReactionKind" NOT NULL DEFAULT 'LIKE';
CREATE INDEX IF NOT EXISTS "Reaction_videoId_kind_idx" ON "Reaction"("videoId", "kind");

-- Comment: social fields
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3);
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "heartedByCreator" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "moderationScore" DOUBLE PRECISION;
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "moderationLabel" TEXT;
CREATE INDEX IF NOT EXISTS "Comment_videoId_pinnedAt_idx" ON "Comment"("videoId", "pinnedAt");

-- Video: scheduled publish
ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "scheduledPublishAt" TIMESTAMP(3);

-- User: DM permission + digest prefs
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dmPermission" "DmPermission" NOT NULL DEFAULT 'ALL';

-- Community Posts
CREATE TABLE IF NOT EXISTS "CommunityPost" (
  "id"          TEXT NOT NULL,
  "channelId"   TEXT NOT NULL,
  "authorId"    TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "imageKey"    TEXT,
  "pollOptions" JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CommunityPost_channelId_createdAt_idx" ON "CommunityPost"("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS "CommunityPost_authorId_idx" ON "CommunityPost"("authorId");
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_channelId_fkey"
  FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Community Poll Votes
CREATE TABLE IF NOT EXISTS "CommunityPollVote" (
  "postId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "optionIdx" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunityPollVote_pkey" PRIMARY KEY ("postId", "userId")
);
ALTER TABLE "CommunityPollVote" ADD CONSTRAINT "CommunityPollVote_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Direct Messages
CREATE TABLE IF NOT EXISTS "DirectMessage" (
  "id"          TEXT NOT NULL,
  "senderId"    TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "readAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DirectMessage_senderId_recipientId_createdAt_idx"
  ON "DirectMessage"("senderId", "recipientId", "createdAt");
CREATE INDEX IF NOT EXISTS "DirectMessage_recipientId_createdAt_idx"
  ON "DirectMessage"("recipientId", "createdAt");
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
