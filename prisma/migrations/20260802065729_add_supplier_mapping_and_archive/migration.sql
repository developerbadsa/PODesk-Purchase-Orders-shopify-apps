-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShopifyProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT,
    "status" TEXT,
    "vendor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopifyProduct_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopifyVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopifyVariantId" TEXT NOT NULL,
    "shopifyInventoryId" TEXT,
    "title" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "tracked" BOOLEAN NOT NULL DEFAULT true,
    "unitCostAmount" REAL,
    "unitCostCurrency" TEXT,
    "inventoryQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitsSold30Days" INTEGER NOT NULL DEFAULT 0,
    "averageDailySales" REAL NOT NULL DEFAULT 0,
    "daysUntilStockout" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopifyVariant_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShopifyVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopifyProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "shopifyLocationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryLocation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "available" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryLevel_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ShopifyVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryLevel_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 14,
    "minimumOrder" INTEGER,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Supplier_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierVariantMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "supplierSku" TEXT,
    "supplierCost" REAL,
    "supplierLeadTimeDays" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupplierVariantMapping_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplierVariantMapping_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplierVariantMapping_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ShopifyVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "expectedArrival" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ShopifyVariant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_shop_key" ON "Store"("shop");

-- CreateIndex
CREATE INDEX "ShopifyProduct_storeId_idx" ON "ShopifyProduct"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyProduct_storeId_shopifyProductId_key" ON "ShopifyProduct"("storeId", "shopifyProductId");

-- CreateIndex
CREATE INDEX "ShopifyVariant_storeId_idx" ON "ShopifyVariant"("storeId");

-- CreateIndex
CREATE INDEX "ShopifyVariant_sku_idx" ON "ShopifyVariant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyVariant_storeId_shopifyVariantId_key" ON "ShopifyVariant"("storeId", "shopifyVariantId");

-- CreateIndex
CREATE INDEX "InventoryLocation_storeId_idx" ON "InventoryLocation"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_storeId_shopifyLocationId_key" ON "InventoryLocation"("storeId", "shopifyLocationId");

-- CreateIndex
CREATE INDEX "InventoryLevel_locationId_idx" ON "InventoryLevel"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLevel_variantId_locationId_key" ON "InventoryLevel"("variantId", "locationId");

-- CreateIndex
CREATE INDEX "Supplier_storeId_idx" ON "Supplier"("storeId");

-- CreateIndex
CREATE INDEX "SupplierVariantMapping_storeId_idx" ON "SupplierVariantMapping"("storeId");

-- CreateIndex
CREATE INDEX "SupplierVariantMapping_variantId_idx" ON "SupplierVariantMapping"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierVariantMapping_supplierId_variantId_key" ON "SupplierVariantMapping"("supplierId", "variantId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_storeId_idx" ON "PurchaseOrder"("storeId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_variantId_idx" ON "PurchaseOrderLine"("variantId");
