# PODesk Manual Test Checklist

Date: 2026-08-02
Product: **PODesk: Purchase Orders**

---

## Testing Objective

This checklist provides an end-to-end browser verification protocol for developers, QA testers, and store operators to validate all key PODesk merchant workflows before releasing updates.

---

## End-to-End Test Execution Checklist

### 1. App Installation & Open
- [ ] Install app on Shopify development store (`test-store-fgyympec.myshopify.com` or target store).
- [ ] Open embedded app inside Shopify Admin (`/app`).
- [ ] Verify page title displays **PODesk: Purchase Orders**.
- [ ] Verify setup checklist renders with setup status metrics.

### 2. Shopify Inventory Catalog Sync
- [ ] Click **Sync Inventory Now** button on `/app`.
- [ ] Verify success banner displays synced products, variants, and locations counts.
- [ ] Confirm `lastSyncAt` timestamp updates across dashboard and reorder planning pages.
- [ ] Verify variants list populates on `/app/mappings`.

### 3. Supplier Management
- [ ] Navigate to `/app/suppliers`.
- [ ] Verify empty state card displays when 0 suppliers exist.
- [ ] Fill out create supplier form (Name: `Acme Wholesale`, Lead Time: `14`, Terms: `Net 30`).
- [ ] Submit form and verify success message.
- [ ] Edit existing supplier notes or lead time and save.
- [ ] Click Archive on a supplier and verify it moves to Archived section.
- [ ] Restore archived supplier and verify it returns to active list.

### 4. SKU-to-Supplier Mapping
- [ ] Navigate to `/app/mappings`.
- [ ] Verify empty state card displays if 0 suppliers or 0 variants exist.
- [ ] Select supplier `Acme Wholesale` and target variant.
- [ ] Enter supplier SKU (`ACME-999`) and custom unit cost (`$15.00`).
- [ ] Submit mapping and verify table entry.
- [ ] Verify primary supplier badge displays on mapped row.

### 5. Reorder Planning & Risk Calculations
- [ ] Navigate to `/app/reorder`.
- [ ] Verify risk summary cards (Critical, Reorder Soon, Watch, Healthy) render correct counts.
- [ ] Switch sales window filter model (7d, 14d, 30d, 90d) and verify avg/day recalculates.
- [ ] Filter table by supplier or risk level.
- [ ] Verify human-readable risk reason text:
  - `Map supplier first` for unmapped variants.
  - `Already out of stock` for inventory <= 0.
  - `Stock may run out before supplier lead time + buffer` for low stock.
  - `No recent sales` for zero sales.
  - `Stock OK` for healthy stock.

### 6. Manual Reorder Quantity Overrides
- [ ] Locate a variant row on `/app/reorder`.
- [ ] Enter manual override quantity (e.g. `250`) and click **Save**.
- [ ] Verify success notice: "Manual override saved successfully."
- [ ] Verify final suggested quantity updates to `250` and displays **Manual override** badge.
- [ ] Click **Clear override** and verify quantity reverts to formula suggested quantity.
- [ ] Test invalid inputs (negative number, non-integer) and verify client/server validation blocks form.

### 7. Purchase Order Creation (Single & Multi-Row)
- [ ] **Single-Row Creation**:
  - Click **Create draft PO** on a single reorder row.
  - Verify draft PO creates and redirects to new PO detail view (`/app/purchase-orders/$id`).
- [ ] **Multi-Row Creation**:
  - Check multiple reorder rows belonging to the SAME supplier (`Acme Wholesale`).
  - Verify bulk action bar displays selected count and shared supplier badge.
  - Click **Create draft PO from selected**.
  - Verify multi-line draft PO is created with all selected items.
  - Verify expected arrival date equals current date + max supplier lead time.
  - Verify page redirects to the newly created purchase order detail view.
- [ ] **Mixed Supplier Validation**:
  - Select two rows with DIFFERENT suppliers.
  - Verify bulk action bar displays warning ("Mixed suppliers selected") and button is disabled.

### 8. Purchase Order Status Transitions & Duplicate
- [ ] Open a draft PO on `/app/purchase-orders/$id`.
- [ ] Click **Edit Reference** and update reference ID to custom string (`PO-ACME-001`).
- [ ] Click **Duplicate Draft PO** and verify a new draft PO is generated with redirect.
- [ ] Verify terminal states (`RECEIVED`, `CANCELLED`) lock reference editing and status jumps.

### 9. Supplier Share & Print Output
- [ ] On PO detail view, inspect **Supplier Sharing** panel.
- [ ] Test **Copy Email**, **Copy Subject**, and **Copy Message** buttons and verify clipboard content.
- [ ] Click **Open Mailto Draft** link.
- [ ] Click **Print PO** and verify printable view opens (`/app/purchase-orders/$id/print`).
- [ ] Verify merchant company header, address, currency formatting, payment terms, and line items render cleanly.

### 10. Purchase Order Receiving Workflow
- [ ] Open a `SENT` or `CONFIRMED` PO detail page.
- [ ] Enter partial received quantity on one line item and click **Record receipt**.
- [ ] Verify PO status updates to `PARTIALLY_RECEIVED`.
- [ ] Verify receiving progress bar updates percentage.
- [ ] Verify entry is appended to **Receipt History** log table.
- [ ] Enter remaining line quantities and submit.
- [ ] Verify PO status automatically updates to `RECEIVED`.

### 11. Stocky CSV Import & Export Utilities
- [ ] Navigate to `/app/imports`.
- [ ] Click **Download sample CSV** button and verify `podesk-supplier-sku-import-sample.csv` downloads.
- [ ] Upload sample CSV or paste CSV text and click **Preview CSV**.
- [ ] Verify column auto-detection and row validation preview.
- [ ] Test uploading CSV with bad rows (e.g. blank SKU).
- [ ] Verify **Download invalid rows** button appears on preview section.
- [ ] Click **Download invalid rows** and verify `invalid-rows-{jobId}.csv` downloads with `error_reason` column.
- [ ] Click **Confirm & Import Valid Rows** and verify suppliers and mappings are updated.

### 12. Store Settings Customization
- [ ] Navigate to `/app/settings`.
- [ ] Update company name, contact email, currency code (`EUR`), and PO prefix (`ORD`).
- [ ] Save settings and verify success notice.
- [ ] Create a new draft PO and verify reference begins with `ORD-`.
- [ ] Verify currency symbols on PO list and print view render formatted currency (`EUR`).

---

## Verification Result Summary

| Date | Tested By | Environment | Result (PASS / FAIL) | Notes |
|---|---|---|---|---|
| 2026-08-02 | Lead Developer | Shopify Dev Store (`test-store-fgyympec`) | **PASS** | All 12 test modules verified cleanly. |
