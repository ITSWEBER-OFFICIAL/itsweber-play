-- First-Run-Setup-Wizard

-- SiteSettings: Wizard-Statusspur. Default false → Middleware redirected
-- frische Installationen auf /setup, INITIAL_ADMIN_EMAIL bleibt als
-- Backward-Compat-Bypass (siehe apps/api/src/trpc/routers/setup.ts).
ALTER TABLE "SiteSettings"
  ADD COLUMN IF NOT EXISTS "setupCompleted"   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "setupCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "setupCompletedBy" TEXT;

-- Bestehende Installationen (Sessions A–L lokal + Unraid) sind bereits
-- konfiguriert. Wenn die Singleton-Row existiert, gilt das Setup als
-- abgeschlossen — sonst springt der Wizard die Existing-Devs ohne Vorwarnung
-- an. Frische Deploys haben keine SiteSettings-Row und bekommen bei der
-- ersten setup.status-Query default false.
UPDATE "SiteSettings"
   SET "setupCompleted" = true,
       "setupCompletedAt" = COALESCE("setupCompletedAt", "updatedAt")
 WHERE "id" = 'singleton';
