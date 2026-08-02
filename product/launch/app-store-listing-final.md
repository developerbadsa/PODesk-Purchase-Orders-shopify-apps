# Shopify App Store Listing Final Draft

Product: **PODesk: Purchase Orders**  
Launch Campaign: **Stocky Rescue by PODesk**  
Status: **Beta Release / Free Listing**  

---

## 1. App Store Header Information

- **App Name**: `PODesk: Purchase Orders`
- **Subtitle**: `Inventory reorder alerts, supplier purchase orders & Stocky CSV import.` *(Within 63 characters limit)*
- **App Icon Description**: Clean corporate desk icon with PO document and upward stock arrow on dark blue gradient.

---

## 2. Short Description

> **Short Description (100–150 words max)**:
> Stop stockouts before they happen and replace messy buying spreadsheets. **PODesk: Purchase Orders** syncs your Shopify catalog, tracks supplier lead times, and calculates exact reorder recommendations based on historical sales velocity. Create multi-line draft purchase orders in seconds, map supplier SKUs and unit costs, record partial or full stock receipts, and import supplier mappings via CSV. Perfect for merchants migrating from Stocky or looking for a clean, read-only purchasing workflow inside Shopify admin. Try 100% free during our launch beta!

---

## 3. Long Description

### Eliminate Stockouts and Streamline Supplier Purchasing

Managing replenishment with spreadsheets or disconnected tools leads to stockouts, missed reorder points, and lost revenue. **PODesk: Purchase Orders** gives Shopify merchants a streamlined, reliable purchase order and reorder planning system directly embedded inside Shopify admin.

Whether you are seeking a reliable alternative to Stocky or simply upgrading from manual spreadsheets, PODesk helps you build a structured buying workflow in minutes.

---

### Key Features

- **Automated Catalog & Sales Sync**: Sync products, variants, active locations, and recent sales velocity with a single click.
- **Velocity-Based Reorder Planning**: View at-risk SKUs instantly. Calculate suggested reorder quantities across 7, 14, 30, or 90-day sales windows with configurable buffer days and lead times.
- **Manual Reorder Overrides**: Override calculated reorder quantities with custom quantities when supplier minimum order quantities (MOQs) or promotional demand require adjustment.
- **Supplier & SKU Mapping**: Maintain supplier profiles with contact info, default lead times, payment terms, and custom supplier SKUs and unit costs. Support multiple suppliers per SKU with primary supplier enforcement.
- **Multi-Line Purchase Orders**: Generate multi-item draft purchase orders for a supplier directly from reorder suggestions or manual line entry. Duplicate past POs with one click.
- **PO Sharing & Supplier Communication**: Format professional purchase orders, copy pre-filled supplier email drafts, open printable PO views, and track sent dates.
- **PO Receiving & Partial Receipts**: Receive inventory line-by-line with support for partial receipts, receiving history logs, and progress indicators.
- **Stocky & Spreadsheet CSV Import**: Upload or paste CSV files to quickly import supplier records and SKU mappings with automatic header detection and validation previews.

---

## 4. Feature Bullets (App Store Summary Bullets)

1. **Reorder Planning Alerts**: Calculate exact reorder quantities based on sales velocity, lead times, and buffer days.
2. **Supplier & SKU Management**: Map supplier SKUs, unit costs, and lead times with primary supplier rules.
3. **Multi-Row Purchase Orders**: Create draft POs from reorder suggestions and edit prices or quantities easily.
4. **PO Receiving Logs**: Track partial or full receipts, view receiving progress, and maintain history logs.
5. **Stocky CSV Import**: Upload or paste CSV spreadsheets to import supplier profiles and SKU mappings effortlessly.

---

## 5. Merchant Benefits

- **Prevent Revenue Loss from Stockouts**: Identify inventory risk before stock hits zero.
- **Save Hours on Replenishment**: Replace complex Excel math with automatic velocity calculations.
- **Professionalize Supplier Operations**: Keep supplier SKUs, lead times, costs, and PO history organized in one place.
- **Risk-Free Migration**: Easily import existing Stocky or spreadsheet supplier data.
- **Zero Shopify Catalog Mutation Risk**: Read-only inventory access means no accidental stock overwrites in your Shopify store during beta.

---

## 6. Target Categories & Search Keywords

### App Store Categories
- **Primary Category**: Orders & Fulfillment -> Order Management
- **Secondary Category**: Inventory Management -> Inventory Sync & Purchasing

### Search Keywords
- `purchase order`
- `reorder point`
- `stocky`
- `supplier management`
- `inventory replenishment`
- `reorder planning`
- `lead time`
- `purchase orders`

---

## 7. App Scope Justification (For Shopify Review Team)

PODesk requests **4 read-only access scopes**:

1. **`read_products`**: Required to read product titles, variant SKUs, barcodes, product handles, and product variant IDs to populate purchase order line items and build SKU-to-supplier mappings.
2. **`read_inventory`**: Required to read current aggregate inventory levels and inventory item IDs to compute stockout risks and calculate suggested reorder quantities.
3. **`read_locations`**: Required to map active stocking locations and assign designated locations to purchase order receiving workflows.
4. **`read_orders`**: Required to read historical order line items and order creation timestamps over 7/14/30/90-day windows to compute daily sales velocity accurately.

> **Why no `write_inventory` scope?**  
> In the current beta release, PODesk is intentionally designed as a read-only reorder planning tool. PODesk does not adjust or write stock numbers back to Shopify admin, protecting merchants from unexpected stock mutation risks.

---

## 8. App Review Notes (For Shopify App Reviewers)

- **Pricing Model**: PODesk is **100% Free** to install and use during the current public beta. No credit card or billing approval is required.
- **Billing Scaffold Note**: A non-blocking plan presentation UI exists at `/app/billing` for future pricing rollout, but no charges are billed.
- **Testing Instructions**:
  1. Install the app on a development store with sample products and orders.
  2. Click **Sync Shopify inventory** on the Dashboard (`/app`) to pull catalog and sales velocity.
  3. Navigate to **Suppliers** (`/app/suppliers`) to create a supplier profile.
  4. Navigate to **SKU Mappings** (`/app/mappings`) to map variants to the supplier.
  5. Open **Reorder Planning** (`/app/reorder`) to test sales window filters, override reorder quantity, and generate a draft PO.
  6. Open **Purchase Orders** (`/app/purchase-orders`), click into the created PO, click **Print PO**, and test line-item receiving via **Record receipt**.
  7. Open **Stocky Import** (`/app/imports`), click **Download sample CSV**, and paste or upload sample rows to test column auto-detection and import preview.

---

## 9. Support Contact

- **Support Email**: `support@podesk.app` *(Note: Replace with active support mailbox before public launch)*
- **Developer Name**: `[Your Business / Developer Name Placeholder]`
