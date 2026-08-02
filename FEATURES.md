# PODesk Features

Date: 2026-08-02

## Product Definition

**PODesk: Purchase Orders** is a Shopify embedded app for merchants who need a clear buying workflow inside Shopify.

The first product does not try to replace an ERP, WMS, accounting platform, forecasting suite, or full inventory operating system. It starts with one commercial promise:

> Help Shopify merchants create purchase orders, manage suppliers, and know what needs to be reordered before stockouts happen.

The first sales wedge is:

> Stocky Rescue by PODesk

Shopify has documented that Stocky will not be available after August 31, 2026, and merchants need to export data they want to keep and move workflows such as purchase orders, supplier receiving, inventory adjustments, transfers, and historical inventory reporting into Shopify admin/POS or another workflow.

## Target Merchant

### Best-Fit Customer

PODesk is for merchants with operational inventory pain, not hobby stores.

Best-fit profile:

- Shopify or Shopify POS store
- 300+ SKUs, or fewer SKUs with frequent replenishment
- 3+ suppliers
- recurring purchase orders
- inventory buying handled by owner, operations manager, retail manager, or purchasing manager
- uses Stocky, spreadsheets, manual Shopify exports, or disconnected supplier documents
- feels stockout pain weekly or monthly
- willing to pay monthly to reduce manual buying mistakes

### Poor-Fit Customer

Do not optimize early product decisions for:

- dropshipping-only stores
- print-on-demand stores
- stores with fewer than 50 SKUs and no supplier complexity
- merchants who only want free apps
- enterprise brands already committed to NetSuite, SAP, Cin7, Brightpearl, or custom ERP
- merchants expecting automated inventory writes, warehouse scanning, accounting sync, and forecasting on day one

## Status Legend

| Status | Meaning |
|---|---|
| Done | Built and working in the current codebase. |
| Done (Verified) | Built and verified on the development Shopify store. |
| Ongoing | Started, but incomplete or not production-ready. |
| Not Started | Planned but not built. |
| Later | Valuable, but intentionally out of MVP scope. |
| Never Build Early | Dangerous scope creep for the first version. |

## Feature Map

| Feature Area | Feature | Status | MVP Priority | Merchant Value |
|---|---|---:|---:|---|
| Shopify foundation | Embedded Shopify app scaffold | Done | P0 | Merchant can install and open the app inside Shopify. |
| Shopify foundation | OAuth and session storage | Done | P0 | App can authenticate stores securely. |
| Shopify sync | Product sync | Done (Verified) | P0 | Pull Shopify product catalog into PODesk. |
| Shopify sync | Variant sync | Done (Verified) | P0 | Connect SKUs and inventory items to reorder workflow. |
| Shopify sync | Location sync | Done (Verified) | P0 | Read active Shopify locations. |
| Shopify sync | Inventory quantity sync | Done (Verified) | P0 | Show current aggregate stock by SKU. Location-level quantities are later. |
| Shopify sync | Recent order sales sync | Done | P0 | Estimate velocity and stockout risk from sales history. |
| Suppliers | Supplier create/list | Done | P0 | Merchant can rebuild supplier records. |
| Suppliers | Supplier edit/delete | Done | P0 | Fix supplier details without support. |
| Suppliers | Supplier lead time | Done | P0 | Reorder recommendations can include buying delay. |
| Suppliers | SKU-to-supplier mapping | Done | P0 | Turn products into supplier-specific buying lists. |
| Purchase orders | Basic PO create/list | Done | P0 | Merchant can create simple buying records. |
| Purchase orders | PO edit | Done | P0 | Merchant can correct drafts before sending. |
| Purchase orders | PO line item table | Done | P0 | Merchant can attach SKUs and quantities to POs. |
| Purchase orders | PO statuses | Done | P0 | Track draft, sent, confirmed, delayed, received, cancelled. |
| Purchase orders | PO supplier email & share workflow | Done | P0 | Merchant can format, copy, mailto draft, print, and mark PO as sent to supplier. Automated SMTP sending remains future work. |
| Reorder planning | Reorder attention table | Done | P0 | Merchant sees SKUs at risk. |
| Reorder planning | Suggested reorder quantity | Done | P0 | Merchant knows what to buy, not only what is low. |
| Reorder planning | Configurable velocity window | Done | P0 | Merchant can use 7/14/30/90-day demand windows. |
| Reorder planning | Exclude out-of-stock days | Not Started | P1 | Avoid bad velocity caused by stockouts. |
| Stocky migration | Stocky import page | Done | P0 | Multi-step CSV import workflow with preview and validation. |
| Stocky migration | Supplier & SKU mapping CSV import | Done | P0 | Merchant can upload or paste CSV to create/update suppliers and SKU mappings. |
| Stocky migration | File upload & paste CSV import | Done | P0 | Supports .csv file upload and raw CSV text paste up to 1000 rows. |
| Stocky migration | Column mapping auto-detection, override & preview | Done | P0 | Auto-detects headers, allows merchant override, then previews valid/invalid rows before execution. |
| Stocky migration | PO history import | Later | P2 | Import historical PO records. |
| Dashboard | Operations snapshot | Done | P0 | Merchant quickly sees synced variants, stock, suppliers, open POs. |
| Dashboard | Actionable empty states | Done | P0 | New user knows next step after install. |
| Billing | Shopify billing | Not Started | P1 | Convert trial users into paying users. |
| Onboarding | First-run setup checklist | Done | P0 | Move merchant from install to first PO fast. |
| App Store | Listing copy and screenshots | Not Started | P1 | Improve install conversion after submission. |
| Reporting | Weekly reorder summary | Not Started | P2 | Bring merchant back to app every week. |
| Automation | Low-stock email alerts | Not Started | P2 | Notify merchant before stockout. |
| Receiving | Receive PO into PODesk | Not Started | P2 | Track incoming stock and close purchase orders. |
| Shopify writes | Write inventory back to Shopify | Later | P3 | Useful later, risky before trust and testing. |
| AI | AI reorder assistant | Later | P4 | Useful only after clean data and enough workflow history. |

## MVP Feature Requirements

### 1. Shopify Install, Auth, And Store Session

Objective:

Allow a merchant to install PODesk from Shopify and open the embedded app without another login.

Must include:

- Shopify OAuth
- session storage
- store record creation
- protected app routes
- uninstall webhook handling

Acceptance criteria:

- merchant can install app on a development store
- app opens inside Shopify admin
- app identifies the shop domain
- session survives page refresh
- uninstall clears or disables store access

Not in MVP:

- custom email/password login
- standalone non-Shopify login
- team permission system

### 2. Shopify Inventory Sync

Objective:

Pull the minimum Shopify data needed to make PODesk useful for purchase orders and reorder planning.

Must include:

- products
- variants
- SKUs
- barcodes
- vendors
- inventory item IDs
- inventory quantities
- active locations
- recent orders for sales velocity

Acceptance criteria:

- merchant clicks `Sync Shopify inventory`
- products and variants save to database
- inventory by location saves to database
- recent sales calculate basic `unitsSold30Days`
- app shows last sync time

Important constraint:

The MVP should read Shopify inventory but should not automatically write inventory changes back to Shopify. Inventory write-back increases risk, review complexity, and support burden.

### 3. Supplier Management

Objective:

Let merchants rebuild the supplier layer that Shopify alone does not fully solve for operational buying.

Must include:

- supplier name
- email
- phone
- lead time days
- minimum order
- payment terms
- notes
- edit supplier
- delete/archive supplier

Acceptance criteria:

- merchant can add a supplier in under one minute
- supplier appears in PO creation
- lead time can be used by reorder logic
- supplier can be corrected without database access

Later:

- supplier-specific SKU costs
- supplier-specific minimum order values
- supplier contact history
- supplier portal

### 4. SKU-To-Supplier Mapping

Objective:

Connect Shopify variants to suppliers so PODesk can tell the merchant who to buy from.

Must include:

- variant search by SKU/title
- assign primary supplier
- optional backup supplier
- supplier SKU
- supplier unit cost
- supplier lead time override

Acceptance criteria:

- merchant can map a SKU to a supplier
- reorder table can group items by supplier
- PO creation can prefill supplier and SKU lines

Why this matters:

Without SKU-to-supplier mapping, PODesk is only a PO note-taking app. With mapping, it becomes a buying workflow.

### 5. Purchase Orders

Objective:

Let merchants create, update, and track purchase orders without spreadsheets.

Must include:

- create PO
- select supplier
- add multiple line items
- quantity
- unit cost
- expected arrival date
- notes
- status
- edit draft PO
- duplicate PO
- basic PO detail page

Status flow:

1. Draft
2. Sent
3. Confirmed
4. Partially Received
5. Received
6. Delayed
7. Cancelled

Acceptance criteria:

- merchant can create a PO from synced SKUs
- merchant can see open POs
- merchant can update status
- merchant can edit draft before sending
- PO lines calculate estimated subtotal

Not in first MVP:

- full accounting sync
- vendor invoice matching
- automated supplier emails
- advanced approval workflow

### 6. Reorder Table

Objective:

Show the merchant which SKUs need attention before they run out.

Must include:

- current inventory quantity
- units sold in selected sales window
- average daily sales
- days until stockout
- supplier lead time
- suggested reorder quantity
- supplier grouping
- search/filter
- risk status

Simple risk logic:

| Risk | Rule |
|---|---|
| Critical | Days left is less than supplier lead time. |
| Reorder Soon | Days left is less than lead time plus buffer days. |
| Watch | Low sales or low stock but no immediate risk. |
| Healthy | Enough stock based on current sales window. |

Formula baseline:

```text
average_daily_sales = units_sold_in_window / selling_days
days_until_stockout = current_inventory / average_daily_sales
suggested_reorder_quantity = target_days_of_stock * average_daily_sales - current_inventory
```

MVP must allow:

- 7-day sales window
- 14-day sales window
- 30-day sales window
- 90-day sales window
- manual target stock days
- manual buffer days

Do not call this AI. It is transparent reorder logic.

### 7. Stocky Migration Workflow

Objective:

Give Stocky users a practical migration path before and after the August 31, 2026 shutdown.

Must include:

- migration landing section
- CSV upload
- CSV preview
- column mapping
- import suppliers
- import supplier contacts
- import PO history when possible
- import SKU-to-supplier mapping when possible
- import notes as raw migration records when data is messy
- clear error report

Acceptance criteria:

- merchant can upload a CSV
- app shows rows before import
- merchant maps columns manually
- invalid rows are not silently imported
- app generates an import result summary

Strict rule:

Do not promise perfect Stocky migration. Promise assisted workflow recovery.

### 8. Onboarding

Objective:

Move merchant from install to first useful outcome fast.

First-run checklist:

1. Sync Shopify inventory
2. Add first supplier
3. Map first SKU to supplier
4. Create first purchase order
5. Review reorder table
6. Upload Stocky/spreadsheet export if relevant

Activation metric:

> A store is activated when it syncs inventory, adds one supplier, maps five SKUs, and creates one purchase order.

Good onboarding should reduce support tickets and improve trial-to-paid conversion.

### 9. Billing And Plans

Objective:

Charge for operational value, not feature novelty.

Recommended launch pricing:

| Plan | Price | Best For | Includes |
|---|---:|---|---|
| Trial | 14 days | Qualified merchants | Full Starter/Pro access during trial. |
| Starter | $39/month | Small shops testing PO workflow | Inventory sync, suppliers, basic POs, reorder table. |
| Pro | $79/month | Serious replenishment workflow | More SKUs, SKU-supplier mapping, PO export, reorder settings. |
| Business | $149/month | POS/multi-location stores | Multi-location views, CSV import, weekly reports, priority support. |
| Migration Service | $299-$999 one-time | Stocky/spreadsheet users | Assisted import, setup, cleanup, and handoff call. |

Do not launch with too many pricing rules. Sell setup help first if trust is low.

### 10. Reporting

Objective:

Give the merchant a reason to return weekly.

Phase 2 reports:

- low stock report
- reorder soon report
- open PO report
- delayed PO report
- supplier lead time report
- dead stock starter report

Not required before first paying users:

- advanced forecasting report
- cash flow planning
- margin analytics
- seasonality analytics

## Screens Needed

### MVP Screens

| Screen | Purpose | Status |
|---|---|---|
| Dashboard | Quick operational snapshot and sync action. | Done |
| Inventory / Reorder Table | Main buying decision screen. | Done |
| Suppliers | Add, edit, and manage suppliers. | Done |
| Supplier Detail | View supplier SKUs and open POs. | Done |
| Purchase Orders List | View all POs and statuses. | Done |
| Purchase Order Detail | Edit lines, status, cost, arrival. | Done |
| Create Purchase Order | Build PO from SKUs and supplier. | Done |
| Stocky Import | Paste/import supplier CSV now; SKU/PO archive import later. | Ongoing |
| Settings | Company profile, PO defaults, prefix, currency code. | Done |
| Billing | Trial and plan management. | Not Started |

## Data Model Requirements

Current core tables:

- Store
- ShopifyProduct
- ShopifyVariant
- InventoryLocation
- InventoryLevel
- Supplier
- PurchaseOrder
- PurchaseOrderLine

Needed additions:

- SupplierVariantMapping
- ImportBatch
- ImportRow
- ReorderSettings
- ReorderSnapshot
- BillingSubscription
- AuditEvent

## App Store Feature Positioning

App title:

> PODesk: Purchase Orders

Subtitle:

> Inventory reorder alerts

Primary value bullets:

- Create purchase orders from Shopify SKUs.
- Manage suppliers, lead times, and reorder workflow.
- See low-stock and stockout-risk items before sales are lost.
- Import Stocky or spreadsheet data with a controlled migration flow.
- Keep buying decisions inside Shopify instead of spreadsheets.

Primary keywords:

- Shopify purchase order app
- Shopify purchase orders
- Shopify inventory reorder
- Shopify reorder alerts
- Shopify supplier management
- Shopify low stock alerts
- Stocky alternative
- Stocky migration

## Features To Avoid Before Traction

Do not build these before at least 10 paying stores:

- automatic Shopify inventory write-back
- warehouse barcode scanning
- full accounting sync
- NetSuite-style ERP workflows
- supplier portal
- AI assistant
- demand forecasting engine
- manufacturing bill of materials
- complex approval rules
- multi-marketplace inventory sync
- customer-facing reorder app features

## Research Notes

This plan is based on the current Shopify platform direction and constraints:

- Shopify Help Center says Stocky will not be available after August 31, 2026, and merchants should export Stocky data and migrate workflows such as purchase orders, receiving, transfers, and inventory history.
- Shopify App Store best practices recommend unique, brand-led names of 30 characters or fewer, with consistent naming between TOML configuration and App Store listing.
- Shopify app categories and tags help merchants find apps by use case, which supports positioning around purchase orders, inventory management, supplier management, and reorder alerts.
- Shopify Admin GraphQL inventory APIs support reading products, variants, inventory items, inventory quantities, locations, and recent orders for operational reporting.

Reference links:

- https://help.shopify.com/en/manual/products/inventory/transitioning-from-stocky
- https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/stocky
- https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices
- https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
- https://shopify.dev/docs/apps/launch/app-store-review/app-listing-categories
- https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps
- https://shopify.dev/docs/api/admin-graphql/latest/queries/orders
- https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryQuantity
