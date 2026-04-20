-- CreateTable
CREATE TABLE "SmtpSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "host" TEXT NOT NULL DEFAULT '',
    "port" INTEGER NOT NULL DEFAULT 587,
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "user" TEXT NOT NULL DEFAULT '',
    "password" TEXT NOT NULL DEFAULT '',
    "fromName" TEXT NOT NULL DEFAULT 'ITSWEBER Play',
    "fromAddress" TEXT NOT NULL DEFAULT '',
    "lastTestAt" TIMESTAMP(3),
    "lastTestResult" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SmtpSettings_pkey" PRIMARY KEY ("id")
);
