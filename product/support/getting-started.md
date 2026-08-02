# Getting Started with PODesk

Welcome! If you're looking to get your purchasing and inventory reordering set up quickly inside Shopify, you're in the right place. Here is a simple, 7-step walkthrough to take you from installing PODesk to sending your first purchase order and logging receipts.

---

## Step 1: Sync your Shopify products & sales data

1. Open **PODesk** inside your Shopify Admin.
2. Head to the **Dashboard** (`/app`) and click **Sync Shopify inventory** at the top.
3. PODesk will grab your products, active stocking locations, current counts, and recent sales.
4. When it finishes, you'll see your total synced counts right on the dashboard.

*Pro tip: Whenever you add new items in Shopify or want updated sales figures, just click Sync Shopify inventory again.*

---

## Step 2: Add your suppliers

1. Click **Suppliers** (`/app/suppliers`) in the left navigation menu.
2. Click **Add Supplier** in the top header.
3. Fill out the vendor details:
   - **Supplier Name** (e.g. Apex Apparel Ltd)
   - **Contact Name & Email** (e.g. orders@apexapparel.com)
   - **Phone & Address**
   - **Default Lead Time** (how many days they take to deliver, e.g. 14 days)
   - **Payment Terms** (e.g. Net 30)
4. Hit **Save Supplier**.

---

## Step 3: Map your SKUs to suppliers

To let PODesk calculate recommendations and build POs, map your Shopify items to the vendors you buy them from:

1. Head over to **SKU Mappings** (`/app/mappings`).
2. Click **Add Mapping** (or filter down to unmapped variants).
3. Select your **Shopify Variant** and choose the matching **Supplier**.
4. Fill in the vendor specifics:
   - **Supplier SKU** (their item number, e.g. APX-JKT-BLK-M)
   - **Unit Cost Price** (your wholesale cost per unit)
   - **Lead Time Override** (only if this item takes longer or shorter than the supplier's default)
   - **Primary Supplier** (check this if they're your main source for this item)
5. Click **Save Mapping**.

---

## Step 4: Check reorder suggestions & tweak overrides

1. Click **Reorder Planning** (`/app/reorder`).
2. Choose your **Sales Window** (7, 14, 30, or 90 days) and set your **Buffer Days** (safety stock).
3. Look for items marked **Critical** (out of stock) or **Lead Time Risk** (running low soon).
4. If you know you have an upcoming sale or need to hit a supplier MOQ, type your custom quantity into the **Reorder Override** box.
5. Select the checkboxes next to items for a single supplier, then click **Create Draft PO**.

---

## Step 5: Review, print & send your purchase order

1. PODesk creates a draft PO and opens the **PO Detail Page** (`/app/purchase-orders/:id`).
2. Double-check your line items, costs, and expected arrival date.
3. Click **Share / Copy Email** to get a formatted email draft ready for your supplier.
4. Click **Print PO** if you want a clean printable sheet or PDF export.
5. Click **Mark as Sent** when you've placed the order with your vendor.

---

## Step 6: Log item receipts when shipments arrive

1. When your delivery arrives, open the PO in PODesk.
2. Click **Record receipt**.
3. Type in how many units arrived for each line item (if it arrived in partial shipments, just enter what came in).
4. Add any tracking or delivery notes.
5. Click **Save Receipt**. PODesk updates your receiving progress bar, updates the PO status, and records a clear receipt history log.

---

## Step 7: Importing data from Stocky or Excel

If you're moving over from Stocky or spreadsheets:

1. Click **Stocky Import** (`/app/imports`).
2. Grab our sample template by clicking **Download sample CSV**.
3. Upload your `.csv` file or paste in raw text.
4. Check the auto-matched columns (Handle, Supplier, Supplier SKU, Cost Price, Lead Time).
5. Click **Preview Validation** to double-check rows.
6. Click **Import Valid Rows** to import your suppliers and mappings instantly.
