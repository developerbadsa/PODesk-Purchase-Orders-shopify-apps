# Troubleshooting PODesk

Ran into a hiccup or an unexpected message while using PODesk? Here are direct solutions to the most common issues merchants and developers run into.

---

## 1. App shows a blank white screen or won't finish loading

**Why it happens:** Your browser session token expired or your browser's privacy settings are blocking cookies inside Shopify's admin frame.

**How to fix it:**
1. Try a hard refresh (`Ctrl + Shift + R` on Windows/Linux or `Cmd + Shift + R` on Mac).
2. Make sure third-party cookies or cross-site tracking protections aren't blocking `admin.shopify.com`.
3. Try opening Shopify Admin in an Incognito / Private window.

---

## 2. "Access Denied" scope errors when running inventory sync

**Why it happens:** Your store has an older login token saved from before we updated access scopes in `shopify.app.toml`.

**How to fix it:**
1. In Shopify Admin, go to **Settings > Apps and sales channels**.
2. Find **PODesk: Purchase Orders** and click **Uninstall**.
3. If running local CLI dev, press `q` to stop your server, then restart with:
   ```bash
   npm run dev -- --reset
   ```
4. Re-install PODesk on your test store and accept the updated permission prompt.
5. Open PODesk and click **Sync Shopify inventory** again.

---

## 3. Inventory sync fails or hits query cost limits

**Why it happens:** Your catalog or order volume is large, hitting Shopify GraphQL API rate limits.

**How to fix it:**
- PODesk syncs up to 1,000 products and 1,000 orders per single sync pass.
- If your catalog has over 5,000 SKUs, wait about 60 seconds for Shopify's API limit bucket to refill, then run the sync again.

---

## 4. No products showing up after sync completes

**Why it happens:** Your Shopify items might be missing SKUs, set to Draft, or untracked.

**How to fix it:**
1. Make sure your product variants in Shopify Admin have **SKUs** filled in. PODesk relies on SKUs to map items.
2. Confirm products are set to **Active** (Draft or Archived items are skipped).
3. Check that variants have **Track quantity** enabled in Shopify.

---

## 5. Reorder table shows no suggestions or "Map supplier first"

**Why it happens:** Either the item isn't linked to a vendor, or there were zero sales in your chosen window.

**How to fix it:**
1. **Link a Supplier:** Go to `/app/mappings` and map the SKU to a supplier. We need lead times to estimate risk.
2. **Expand Sales Window:** If an item didn't sell in 30 days, try selecting a 90-day window.
3. **Use Manual Override:** If you know an item needs reordering anyway, enter your own number in the **Reorder Override** field on `/app/reorder`.

---

## 6. CSV import skipping rows or throwing errors

**Why it happens:** Column names don't match, or SKUs in your file don't exist in Shopify.

**How to fix it:**
1. Make sure your headers match or use the column dropdowns on the preview page. Required columns: `handle` or `sku`, and `supplier_name`.
2. Check that the SKUs in your spreadsheet match your Shopify SKUs character-for-character.
3. Click **Export Invalid Rows** on the import page to get a CSV listing only the failed rows with exact reasons.

---

## 7. Purchase order won't record item receiving

**Why it happens:** The PO is still in Draft state or entered numbers exceed what's left.

**How to fix it:**
1. Make sure the PO status is `SENT`, `CONFIRMED`, or `PARTIALLY_RECEIVED`. Click **Mark as Sent** first if it's still a Draft.
2. Ensure received quantities aren't negative and don't exceed the remaining balance.

---

## 8. Can't select items from different suppliers for one PO

**Why it happens:** A single purchase order can only be sent to one vendor at a time.

**How to fix it:** Use the **Supplier Filter** dropdown at the top of the Reorder table to filter by a single vendor before selecting checkboxes.

---

## 9. Session token expired on dev store

If you're testing on a Partner Development store, tokens expire after non-use. Simply uninstall the app from Shopify Admin settings and restart `npm run dev` to generate a fresh token.
