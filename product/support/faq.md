# PODesk FAQ & Help Guide

Got questions about how PODesk handles your store data, purchase orders, or inventory? Here are straightforward answers to what merchants ask us most.

---

### Q1: Is PODesk actually free?
**Yes, completely.** During our public beta, every single feature in PODesk is free. That includes catalog sync, supplier management, SKU mapping, reorder math, PO receiving, and CSV imports. We don't ask for a credit card, and there are no hidden limits during the beta.

---

### Q2: Will PODesk change or mess up my Shopify stock levels?
**No, never.** PODesk works on a strictly **read-only** connection to your Shopify inventory. We read your products, current stock counts, and recent sales to calculate reorders and help you build purchase orders inside PODesk.

When you receive items or update a purchase order in PODesk, we do **not** write those stock numbers back into Shopify automatically. This keeps your Shopify catalog 100% safe from accidental changes while you test the app.

---

### Q3: What store data does PODesk pull from Shopify?
We only pull what is necessary to handle inventory planning:
1. **Products & Variants**: Product titles, SKU codes, barcodes, variant names, handles, and supplier vendor names.
2. **Locations**: The active stocking locations set up in your Shopify Admin.
3. **Inventory Items**: Aggregate stock counts across your locations.
4. **Recent Orders**: Line items and sale dates over 7, 14, 30, or 90 days so we can figure out your daily sales velocity.

---

### Q4: What is a supplier mapping?
Think of mapping as linking a Shopify product to the exact vendor you buy it from. In PODesk, a mapping connects your variant SKU to a supplier along with:
- **Supplier SKU**: The vendor's item code or part number.
- **Unit Cost**: What you pay wholesale per unit.
- **Lead Time**: How many days it takes for that supplier to ship and deliver.
- **Primary Supplier Flag**: Lets you mark your main vendor if you buy an item from multiple places.

---

### Q5: How does PODesk figure out reorder recommendations?
We use a clean, transparent formula based on how fast you sell items and how long suppliers take to deliver:

$$\text{Suggested Reorder Qty} = (\text{Target Days of Stock} \times \text{Daily Sales Velocity}) - \text{Current Stock} + \text{Safety Buffer}$$

- **Daily Sales Velocity**: Total units sold divided by your chosen window (7, 14, 30, or 90 days).
- **Target Days**: How many days of inventory you want on hand (for example, 30 days).
- **Safety Buffer**: Extra buffer days so you don't run out during unexpected surges.

Items are flagged with clear status tags: **Critical** (already out of stock), **Lead Time Risk** (stock will run out before a new shipment arrives), **Low Stock**, or **Stock OK**.

---

### Q6: Can I change or override the recommended reorder amount?
**Yes.** On the Reorder page (`/app/reorder`), you can type your own number into the **Reorder Override** box for any item. Maybe you know a sale is coming up, or your supplier requires a minimum order quantity (MOQ). Your override is saved automatically and used whenever you generate a draft PO. Overridden items get a clear `"Manual override"` badge so you know who changed what.

---

### Q7: Can I bring over data from Stocky or my own spreadsheets?
**Yes.** We built a CSV Import tool (`/app/imports`) specifically for merchants moving off Stocky or Excel. You can upload a `.csv` file or paste raw text. PODesk auto-matches your column headers, lets you tweak the mapping, previews the data before importing, and gives you a downloadable report if any rows need fixing. We also provide a sample template CSV on the import page.

---

### Q8: Can I track item receiving on purchase orders?
**Yes.** Open any purchase order (`/app/purchase-orders/:id`) and click **Record receipt**. You can enter incoming item counts line-by-line. If shipment arrives in parts, PODesk tracks partial receipts, updates the PO status (`PARTIALLY_RECEIVED` or `RECEIVED`), and keeps a timestamped receipt log so you know exactly what arrived and when.

---

### Q9: Can I email purchase orders straight to suppliers?
**Yes.** On any PO page, click **Share / Copy Email**. PODesk formats a pre-filled email draft with your supplier's contact details, PO reference, line items, and grand totals. You can copy the subject and body in one click, launch your default email app (`mailto:` link), or print a clean PDF/paper copy. Once sent, click **Mark as Sent** to log the date and count.

---

### Q10: Does PODesk handle multi-location inventory?
Currently, PODesk syncs all your active Shopify locations and calculates reorders against your total aggregate store stock. Specific location-by-location reorder splits and stock transfer tools are planned for a future update.

---

### Q11: How do I uninstall or get my data removed?
Uninstalling is standard: go to **Shopify Admin > Settings > Apps and sales channels > Uninstall**. Once uninstalled, Shopify sends an automated webhook to our servers, revoking access immediately. All store records, session tokens, suppliers, mappings, and POs are scheduled for complete deletion within 30 days per our [Data Deletion Policy](/data-deletion). If you need immediate data removal, drop us a line at `podeskapp@gmail.com`.
