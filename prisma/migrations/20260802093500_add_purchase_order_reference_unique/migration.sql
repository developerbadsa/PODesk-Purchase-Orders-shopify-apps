-- Prevent duplicate purchase order references within the same Shopify store.
CREATE UNIQUE INDEX "PurchaseOrder_storeId_reference_key" ON "PurchaseOrder"("storeId", "reference");
