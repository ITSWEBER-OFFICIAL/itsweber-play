-- CreateTable
CREATE TABLE "ThemeAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThemeAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ThemeAuditLog_createdAt_idx" ON "ThemeAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ThemeAuditLog_userId_idx" ON "ThemeAuditLog"("userId");
