-- CreateTable
CREATE TABLE "ThemeSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "tokensOverride" JSONB NOT NULL DEFAULT '{}',
    "customCss" TEXT,
    "logoFilter" TEXT,
    "activePreset" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ThemeSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeRevision" (
    "id" TEXT NOT NULL,
    "customCss" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThemeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThemeRevision_createdAt_idx" ON "ThemeRevision"("createdAt");
