# Troubleshooting & Error Resolution Guide for PODesk

Product: **PODesk: Purchase Orders**  
Category: Technical Troubleshooting & Merchant Support  

---

This guide provides step-by-step resolution steps for common issues encountered during development, installation, sync, and purchase order operations.

---

## 1. App Shows Blank Page or Loading Spinner Indefinitely

### Symptoms
Opening PODesk inside Shopify Admin displays a blank white screen or continuous loading spinner.

### Root Causes & Solutions
- **Expired Session Token**: Browser session token has expired or is blocked by browser cross-site tracking policies.
- **Solution**: 
  1. Hard refresh your browser frame (`Ctrl + Shift + R` or `Cmd + Shift + R`).
  2. Ensure third-party cookies or cross-site tracking protections are allowed for Shopify Admin (`admin.shopify.com`).
  3. Try opening Shopify Admin in an Incognito/Private window.

---

## 2. "Access Denied" Scope Errors During Inventory Sync

### Symptoms
Sync fails with an error notification such as `"Access denied for products field"` or `"Access denied for locations field"`.

### Root Cause
The development store or app session holds an outdated access token generated before required access scopes (`read_products,read_inventory,read_locations,read_orders`) were set in `shopify.app.toml`.

### Resolution Steps
1. Open Shopify Admin on your store, go to **Settings > Apps and sales channels**.
2. Locate **PODesk: Purchase Orders** and click **Uninstall**.
3. If running CLI development, stop server (`q`), then restart with reset:
   ```bash
   npm run dev -- --reset
   ```
4. Re-install PODesk on your development store and accept the updated permission prompts.
5. Re-open PODesk and click **Sync Shopify inventory** again.

---

## 3. Inventory Sync Query Fails or Cost Exceeded

### Symptoms
Sync fails with GraphQL query cost limit errors or timeout messages.

### Root Cause
Catalog or order volume exceeds default query limits.

### Resolution Steps
- PODesk limits products to 1,000 items (40 pages × 25 items) and orders to 1,000 items (10 pages × 25 items) per single sync action.
- If your catalog exceeds 5,000 SKUs, wait 60 seconds for Shopify GraphQL leaky-bucket rate limits to replenish, then re-trigger sync.
- Check server log output for specific GraphQL query cost messages.

---

## 4. No Products Displayed After Sync

### Symptoms
Sync reports success, but products or variants do not appear in SKU Mappings or Reorder table.

### Resolution Steps
1. Verify that your products in Shopify Admin have **SKUs** defined. PODesk filters and maps variants using Shopify SKUs.
2. Ensure products are set to **Active** status in Shopify Admin (Draft or Archived products are excluded by default).
3. Confirm that variants have **Track quantity** enabled in Shopify Admin.

---

## 5. Reorder Table Shows No Suggestions or "Map Supplier First"

### Symptoms
Reorder Planning table shows SKUs with zero suggested quantity or `"Map supplier first"` status reason.

### Resolution Steps
1. **Assign Supplier Mapping**: Reorder quantity calculations require supplier lead times to accurately estimate stockout risks. Go to `/app/mappings` and map the SKU to a supplier.
2. **Sales Velocity Check**: If a product had zero sales in the selected window (e.g. past 30 days), daily sales velocity is zero. Try selecting a broader sales window (e.g., 90 days).
3. **Manual Override**: If you know demand exists despite zero historical Shopify sales, enter a custom number in the **Reorder Override** field on `/app/reorder`.

---

## 6. CSV Import Reports Invalid Rows

### Symptoms
Uploading or pasting a CSV file on `/app/imports` results in skipped rows or invalid row warnings.

### Resolution Steps
1. **Header Matching**: Ensure column headers match expected names or use column override dropdowns. Required columns: `handle` or `sku`, and `supplier_name`.
2. **Shopify SKU Matching**: Verify that SKUs in your CSV exactly match existing Shopify variant SKUs in your catalog.
3. **Download Invalid Rows Export**: Click **Export Invalid Rows** to download a CSV containing only the failed rows along with row-level error reasons (e.g. `"Variant SKU not found in store catalog"`).
4. **Sample Template**: Download `podesk-supplier-sku-import-sample.csv` from the import page as a baseline reference.

---

## 7. Purchase Order Cannot Be Received

### Symptoms
Clicking **Record receipt** or saving line item receipts on a PO page yields an error or fails to update.

### Resolution Steps
1. Verify PO status is `SENT`, `CONFIRMED`, or `PARTIALLY_RECEIVED`. POs in `DRAFT` status must be marked as sent before receiving items.
2. Check received quantity inputs: received quantity cannot be negative or exceed remaining unreceived balance.

---

## 8. Mixed Supplier Selection Blocked During PO Creation

### Symptoms
When selecting multiple rows on the Reorder table, **Create Draft PO** button is disabled or displays a validation warning.

### Resolution Steps
- Multi-row draft PO creation requires **all selected SKUs to belong to the same supplier**.
- Filter the Reorder table by a single supplier using the **Supplier Filter** dropdown before selecting rows.

---

## 9. Development Store Reinstall Note

If testing on a Partner Development store:
- Development store session tokens expire periodically.
- If GraphQL authorization errors occur after non-use, uninstall the app from Shopify Admin settings and launch `npm run dev` to re-issue clean OAuth credentials.
