-- Store merchant preference for supplier email delivery behavior.
-- Auto-send still requires a merchant review confirmation before delivery.
CREATE TYPE "SupplierEmailAutomationMode" AS ENUM ('REVIEW_BEFORE_SEND', 'AUTO_SEND_AFTER_REVIEW');

ALTER TABLE "StoreSettings"
ADD COLUMN "supplierEmailAutomationMode" "SupplierEmailAutomationMode" NOT NULL DEFAULT 'REVIEW_BEFORE_SEND';
