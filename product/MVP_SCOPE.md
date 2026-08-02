# PODesk MVP Scope

## MVP Principle

The MVP is not a full inventory platform.

The MVP exists to prove:

> Merchants will pay for a simple Stocky migration path plus purchase order and reorder workflow.

## MVP Positioning

Public name:

> PODesk: Purchase Orders

Campaign:

> Stocky Rescue by PODesk

First promise:

> Keep purchase orders, suppliers, and reorder planning running after Stocky.

## MVP User

Primary user:

- store owner
- operations manager
- inventory manager
- retail manager

Merchant profile:

- Shopify store
- uses Shopify POS or multiple locations
- 300+ SKUs
- creates supplier purchase orders
- previously used Stocky or spreadsheets

## MVP Must-Have Features

### 1. Shopify OAuth

Merchant can connect the Shopify store.

Required scopes:

- read_products
- read_inventory
- read_locations
- read_orders

Write scopes should be avoided in first MVP unless absolutely needed.

Reason:

Reading data is safer. Do not change merchant inventory until trust is earned.

### 2. Shopify Data Sync

Sync:

- products
- variants
- SKUs
- inventory items
- inventory levels
- locations
- orders for sales velocity

Need:

- initial sync
- manual resync button
- sync status page
- failed sync logs

### 3. Stocky Import

Support CSV/manual import for:

- supplier records
- PO archive
- item-supplier mapping if available
- notes/status if available

Reality:

Stocky data may be messy. MVP should accept manual cleanup.

### 4. Suppliers

CRUD:

- name
- email
- phone
- lead time days
- minimum order quantity
- payment terms
- notes

### 5. Purchase Orders

CRUD:

- supplier
- PO number
- expected arrival date
- status
- line items
- quantity
- unit cost
- notes

Exports:

- CSV
- PDF later if fast

Statuses:

- draft
- sent
- confirmed
- partially received
- received
- delayed
- cancelled

### 6. Basic Reorder Table

Show:

- SKU
- product/variant
- current inventory
- average daily sales
- days left
- supplier lead time
- suggested reorder date
- suggested quantity

Formula:

```text
average_daily_sales = units_sold_last_n_days / n
days_left = current_inventory / average_daily_sales
reorder_date = today + days_left - supplier_lead_time - safety_stock_days
suggested_qty = demand_during_lead_time + safety_stock - available - incoming
```

Important:

Show assumptions. Do not pretend the forecast is perfect.

### 7. Low Stock Alert

MVP alert:

- daily email digest
- only sends when SKU crosses risk threshold
- no alert storms

### 8. Export

Export:

- reorder table CSV
- suppliers CSV
- PO CSV

## MVP Nice-To-Have

Only after must-haves:

- PDF purchase orders
- receiving against PO
- simple dashboard cards
- Slack alerts
- bundle component risk

## Not In MVP

Do not build:

- billing
- enterprise roles
- Shopify inventory write-back
- full receiving
- barcode scanning
- mobile app
- supplier portal
- marketplace sync
- accounting sync
- AI assistant
- full WMS
- full ERP

## Reason For Tight Scope

The app must become reliable before it becomes powerful.

Inventory tools fail when they show wrong numbers. A smaller accurate app is better than a broad unreliable one.

## First Version Success Criteria

The MVP succeeds if a merchant can:

1. Install app.
2. See inventory by SKU and location.
3. Import or recreate supplier/PO data.
4. Create a new PO.
5. See which SKUs need reorder attention.
6. Export reorder/PO data.

## First Version Failure Criteria

The MVP fails if:

- sync data is not trusted
- merchant cannot understand reorder assumptions
- import takes too much manual work
- PO workflow is slower than spreadsheet
- no merchant agrees to pay after trying it
