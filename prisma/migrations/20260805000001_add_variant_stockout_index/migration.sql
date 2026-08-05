-- Add composite index on ShopifyVariant(storeId, daysUntilStockout).
-- Speeds up reorder planning and dashboard at-risk variant queries
-- that filter by storeId and sort/range filter on daysUntilStockout.
CREATE INDEX IF NOT EXISTS "ShopifyVariant_storeId_daysUntilStockout_idx" ON "ShopifyVariant"("storeId", "daysUntilStockout");
