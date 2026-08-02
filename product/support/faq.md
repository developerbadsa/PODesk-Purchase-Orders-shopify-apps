# Frequently Asked Questions (FAQ) for PODesk

Product: **PODesk: Purchase Orders**  
Category: Merchant Help & Support  

---

### Q1: Is PODesk free?
**Yes.** PODesk is 100% free to install and use during our public launch beta. All current features—including inventory sync, supplier management, SKU mapping, reorder planning, purchase order receiving, and CSV import—are available without subscription fees or credit card requirements.

---

### Q2: Does PODesk change Shopify inventory?
**No.** In the current release, PODesk operates on a strictly **read-only** basis regarding your Shopify store inventory. It syncs product details, inventory levels, and historical sales velocity to calculate reorder recommendations and manage purchase orders within PODesk. Receiving items or updating purchase orders within PODesk does **not** write stock counts back to your Shopify catalog, protecting your store from accidental inventory changes.

---

### Q3: What data is synced from my Shopify store?
PODesk syncs four main data categories:
1. **Products & Variants**: Product titles, variant titles, SKUs, barcodes, product handles, and variant IDs.
2. **Locations**: Active inventory stocking locations configured in your Shopify admin.
3. **Inventory Items**: Aggregate stock quantities across your active locations.
4. **Recent Orders**: Order line items and sales timestamps over historical windows (7, 14, 30, and 90 days) to compute daily sales velocity.

---

### Q4: What is a supplier mapping?
A supplier mapping connects a Shopify product variant SKU to a specific supplier record in PODesk. It allows you to specify:
- **Supplier SKU**: The supplier's item code or part number.
- **Unit Cost**: Your wholesale purchase cost from the supplier.
- **Lead Time**: Days required for the supplier to fulfill and deliver an order.
- **Primary Supplier Status**: Marks whether this supplier is your main replenishment source for the SKU.

---

### Q5: How does reorder quantity work?
PODesk calculates suggested reorder quantities using historical sales velocity and supplier lead times:

$$\text{Suggested Reorder Qty} = (\text{Target Days} \times \text{Daily Sales Velocity}) - \text{Current Stock} + \text{Safety Buffer}$$

- **Daily Sales Velocity**: Total units sold divided by the selected sales window (7, 14, 30, or 90 days).
- **Target Days**: Desired inventory coverage period (e.g. 30 days of stock).
- **Safety Buffer**: Additional safety stock buffer days.

SKUs are categorized into risk levels: **Critical** (out of stock), **Lead Time Risk** (stock running out before lead time delivery), **Low Stock**, and **Stock OK**.

---

### Q6: Can I override the suggested reorder quantity?
**Yes.** On the Reorder Planning page (`/app/reorder`), you can type a custom quantity directly into the **Reorder Override** field for any SKU. Your override is saved automatically per store and takes precedence over the formula calculation when generating draft purchase orders. A `"Manual override"` badge will appear on overridden lines.

---

### Q7: Can I import Stocky data or spreadsheet CSV files?
**Yes.** PODesk features a dedicated CSV Import tool (`/app/imports`). You can upload a `.csv` file or paste raw CSV text containing your suppliers and SKU mappings. PODesk auto-detects column headers, allows manual mapping overrides, validates rows before importing, and displays detailed error reports for invalid rows. A downloadable sample CSV template is provided.

---

### Q8: Can I receive purchase orders in PODesk?
**Yes.** On any purchase order detail page (`/app/purchase-orders/:id`), click **Record receipt** to enter received quantities line-by-line. PODesk supports both partial and full receipts, tracks line-level receiving progress, updates PO statuses automatically (`PARTIALLY_RECEIVED` or `RECEIVED`), and records timestamped receipt history logs.

---

### Q9: Can I email purchase orders to suppliers?
**Yes.** PODesk includes a manual supplier email sharing workflow. From any PO detail page, click **Share / Copy Email** to generate a pre-formatted email message with supplier contact info, PO reference, line items, and totals. You can copy the subject and body with one click, launch a native `mailto:` draft in your default email client, print clean PO copies, and click **Mark as Sent** to log communication timestamps. *(Direct automated background SMTP emailing is planned for a future update).*

---

### Q10: Does PODesk support multi-location inventory?
PODesk syncs active locations and computes aggregate store inventory. Reorder calculations evaluate total store stock across locations. Dedicated multi-location reorder split rules and transfers are planned for future major releases.

---

### Q11: How do I uninstall PODesk or request data deletion?
You can uninstall PODesk at any time via **Shopify Admin > Settings > Apps and sales channels > Uninstall**. Upon receiving Shopify's `app/uninstalled` or `shop/redact` webhooks, all OAuth session tokens are revoked and store data is scheduled for complete deletion within 30 days per our [Data Deletion Policy](/data-deletion). For immediate data removal during beta, email support at `support@podesk.app` *(Note: Replace with active support mailbox before public launch)*.
