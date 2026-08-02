-- CreateTable
CREATE TABLE "ReorderOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "overrideQuantity" INTEGER,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReorderOverride_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReorderOverride_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ShopifyVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReorderOverride_storeId_idx" ON "ReorderOverride"("storeId");

-- CreateIndex
CREATE INDEX "ReorderOverride_variantId_idx" ON "ReorderOverride"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "ReorderOverride_storeId_variantId_key" ON "ReorderOverride"("storeId", "variantId");
