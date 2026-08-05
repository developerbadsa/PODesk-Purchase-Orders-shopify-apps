-- Add index on Session.shop for faster findSessionsByShop lookups.
-- Without this, every authenticate.admin() call does a full table scan.
CREATE INDEX IF NOT EXISTS "Session_shop_idx" ON "Session"("shop");
