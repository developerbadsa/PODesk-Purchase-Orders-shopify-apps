# Getting Started Guide for PODesk

Product: **PODesk: Purchase Orders**  
Target Audience: Shopify Merchants & Warehouse Managers  
Goal: From Install to First Purchase Order in 10 Minutes  

---

Welcome to **PODesk: Purchase Orders**! This guide walks you step-by-step through setting up your store, mapping your products, analyzing reorder suggestions, and issuing purchase orders.

---

## Step 1: Sync Your Shopify Inventory & Sales Velocity

1. Open **PODesk** inside your Shopify Admin frame.
2. On the **Operations Dashboard** (`/app`), click the **Sync Shopify inventory** button in the top banner.
3. PODesk will pull your Shopify products, variants, active locations, and recent sales velocity.
4. Once completed, review your synced catalog counts (e.g. `26 variants synced across 2 locations`).

> **Tip**: Run **Sync Shopify inventory** whenever you add new products or want to refresh sales velocity calculations.

---

## Step 2: Add Your Suppliers

1. Navigate to **Suppliers** (`/app/suppliers`) from the app menu.
2. Click **Add Supplier** in the top right header.
3. Fill out your supplier's profile:
   - **Supplier Name** *(Required, e.g. Apex Apparel Ltd)*
   - **Contact Name & Email** *(e.g. orders@apexapparel.com)*
   - **Phone & Business Address**
   - **Default Lead Time (Days)** *(e.g. 14 days)*
   - **Payment Terms** *(e.g. Net 30)*
4. Click **Save Supplier**.

---

## Step 3: Map SKUs to Suppliers

To enable velocity reordering and PO creation, map your Shopify variants to their respective suppliers:

1. Navigate to **SKU Mappings** (`/app/mappings`).
2. Click **Add Mapping** (or filter by unmapped SKUs).
3. Select the **Shopify Product Variant** and choose the **Supplier**.
4. Enter supplier-specific details:
   - **Supplier SKU** *(e.g. APX-JKT-BLK-M)*
   - **Unit Cost Price** *(e.g. $35.00)*
   - **Lead Time Override** *(Optional override if different from supplier default)*
   - **Primary Supplier** *(Check if this is your main supplier for this SKU)*
5. Click **Save Mapping**.

---

## Step 4: Use Reorder Planning & Set Overrides

1. Navigate to **Reorder Planning** (`/app/reorder`).
2. Select your desired **Sales Window** (7, 14, 30, or 90 days) and **Buffer Days** (safety stock).
3. Review SKUs flagged as **Critical** (out of stock) or **Lead Time Risk**.
4. *(Optional)* If you know demand will spike or need to meet supplier Minimum Order Quantities (MOQs), type a custom number in the **Reorder Override** field for any SKU.
5. Select the checkboxes next to the SKUs you want to reorder for a specific supplier.
6. Click **Create Draft PO** at the top of the table.

---

## Step 5: Format, Print & Share Purchase Orders

1. PODesk automatically generates a multi-line draft purchase order and opens the **PO Detail Page** (`/app/purchase-orders/:id`).
2. Review line items, quantities, unit costs, and subtotal. Add internal notes or expected arrival dates if needed.
3. Click **Share / Copy Email** to generate a pre-formatted email draft for your supplier.
4. Click **Print PO** to generate a clean, merchant-branded printable PO document or PDF export.
5. Click **Mark as Sent** to update the PO status to `SENT`.

---

## Step 6: Receive Purchase Orders & Track Inventory

1. When shipment arrives from your supplier, open the purchase order in PODesk.
2. Click **Record receipt**.
3. Enter the received quantities for each line item (supports partial receiving if items arrive in multiple shipments).
4. Enter optional receiving notes or delivery tracking references.
5. Click **Save Receipt**. PODesk updates receiving progress bars, transitions PO status to `PARTIALLY_RECEIVED` or `RECEIVED`, and logs receipt history.

---

## Step 7: Import Data via CSV (Stocky Migration)

If you are migrating from Stocky or spreadsheets:

1. Navigate to **Stocky Import** (`/app/imports`).
2. Click **Download sample CSV** to review the expected file layout.
3. Upload your `.csv` file or paste raw CSV text.
4. Review the auto-detected column headers (Handle, Supplier, Supplier SKU, Cost Price, Lead Time).
5. Click **Preview Validation** to review valid vs. invalid rows.
6. Click **Import Valid Rows** to complete your catalog migration in seconds.
