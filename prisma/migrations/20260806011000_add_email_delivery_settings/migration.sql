-- Store merchant-owned email delivery credentials for optional supplier PO auto-send.
-- Idempotent because the production database received these columns before the
-- migration file existed.
DO $$
BEGIN
  CREATE TYPE "EmailProvider" AS ENUM ('SMTP', 'RESEND');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "StoreSettings"
ADD COLUMN IF NOT EXISTS "emailProvider" "EmailProvider" NOT NULL DEFAULT 'SMTP',
ADD COLUMN IF NOT EXISTS "resendApiKey" TEXT,
ADD COLUMN IF NOT EXISTS "resendFromEmail" TEXT,
ADD COLUMN IF NOT EXISTS "smtpHost" TEXT,
ADD COLUMN IF NOT EXISTS "smtpPort" INTEGER,
ADD COLUMN IF NOT EXISTS "smtpUser" TEXT,
ADD COLUMN IF NOT EXISTS "smtpPassword" TEXT;
