# Screenshot Capture Production Pack for Shopify App Store

Product: **PODesk: Purchase Orders**  
Target Resolution: **1280 x 800 px** (16:10 aspect ratio) or **2560 x 1600 px** (Retina PNG)  
Format: **PNG, RGB, compressed under 2 MB per file**  

---

## Screenshot 1: Dashboard Overview (App Store Hero Image)

- **Screen Name**: Operations Dashboard
- **Target URL**: `https://admin.shopify.com/store/YOUR-STORE/apps/podesk/app`
- **Shopify App Store Purpose**: Primary Hero Screenshot (First image in listing).
- **Sample Data Needed**:
  - Synced products count: `17 products`, `26 variants`, `2 locations`.
  - Active suppliers count: `4 suppliers`.
  - Open POs count: `3 open POs ($4,250.00 total)`.
  - Reorder Risk Banner: `3 SKUs at critical stockout risk`.
- **What Must Be Visible**:
  - Embedded Shopify Admin header and sidebar framing.
  - Quick action banner with **Sync Shopify inventory** button showing last sync timestamp.
  - Key metric card widgets (Synced Variants, Suppliers, Open POs, Stockout Risk).
  - Top at-risk SKUs summary preview table.
- **Caption**: *"Get instant visibility into stockout risks, synced inventory, and open purchase orders inside Shopify admin."*

---

## Screenshot 2: Reorder Planning & Manual Overrides

- **Screen Name**: Reorder Recommendations Table
- **Target URL**: `https://admin.shopify.com/store/YOUR-STORE/apps/podesk/app/reorder`
- **Shopify App Store Purpose**: Core Feature Screenshot (Reorder planning & overrides).
- **Sample Data Needed**:
  - Filter selected: `Sales window: 30 days`, `Buffer days: 7`, `Target days: 30`.
  - Risk badges: `Critical (0 stock)`, `Lead Time Risk (2 days left)`, `Low Stock`.
  - SKUs: Real apparel/coffee/tech items (e.g., `Classic Leather Jacket - M`, `Organic Espresso Beans 1kg`).
  - Reorder quantities with at least one line showing a **Manual override** input value and `"Manual override"` badge.
- **What Must Be Visible**:
  - Top summary cards: `Critical Stockouts (3)`, `Lead Time Risk (2)`, `Total Reorder Value ($2,140.00)`.
  - Filter bar controls (sales window dropdown, buffer days input).
  - Checkbox selection column for multi-row draft PO generation.
  - **Create Draft PO** action button at top of table.
- **Caption**: *"Calculate velocity-based reorder quantities, override formula suggestions, and generate multi-line draft POs in seconds."*

---

## Screenshot 3: Supplier Profiles & SKU Mappings

- **Screen Name**: SKU-to-Supplier Mapping Management
- **Target URL**: `https://admin.shopify.com/store/YOUR-STORE/apps/podesk/app/mappings`
- **Shopify App Store Purpose**: Supplier Operations Screenshot.
- **Sample Data Needed**:
  - Suppliers: `Apex Apparel Ltd`, `BeanCraft Roasters`, `Nexus Tech Wholesale`.
  - Mapped SKUs with custom Supplier SKUs (e.g., `APX-JKT-BLK-M`), Unit Costs (`$35.00`), Lead Times (`14 days`).
  - Primary supplier tag badge (`"Primary"`).
- **What Must Be Visible**:
  - Supplier filter dropdown and search input.
  - Table columns: Shopify Product / SKU, Supplier Name, Supplier SKU, Unit Cost, Lead Time, Primary Status, Actions.
  - **Add SKU Mapping** modal or form trigger button.
- **Caption**: *"Map Shopify SKUs to suppliers with custom supplier SKUs, unit costs, lead times, and primary supplier rules."*

---

## Screenshot 4: Purchase Order Details & Sharing Workflow

- **Screen Name**: Purchase Order Detail Page
- **Target URL**: `https://admin.shopify.com/store/YOUR-STORE/apps/podesk/app/purchase-orders/1`
- **Shopify App Store Purpose**: Purchase Order Management Screenshot.
- **Sample Data Needed**:
  - PO Reference: `PO-20260802-001`.
  - Supplier: `Apex Apparel Ltd` (with email, phone, terms).
  - PO Status Badge: `SENT` or `PARTIALLY RECEIVED`.
  - Line items: 3 apparel lines with quantities, unit costs, line totals, and subtotals (`$1,850.00`).
- **What Must Be Visible**:
  - Action buttons: **Print PO**, **Share / Copy Email**, **Record receipt**, **Duplicate PO**.
  - Supplier detail box and PO terms summary.
  - Supplier email preview modal or copy button feedback.
- **Caption**: *"Manage multi-line purchase orders, format printable POs, share email drafts with suppliers, and track PO statuses."*

---

## Screenshot 5: Purchase Order Receiving & Progress Logs

- **Screen Name**: PO Receiving Workflow
- **Target URL**: `https://admin.shopify.com/store/YOUR-STORE/apps/podesk/app/purchase-orders/1`
- **Shopify App Store Purpose**: Inventory Receiving Screenshot.
- **Sample Data Needed**:
  - PO status: `PARTIALLY RECEIVED`.
  - Line items showing: `Ordered: 50`, `Previously Received: 20`, `Now Receiving: 15`, `Remaining: 15`.
  - Progress bar: `70% Received (35 / 50 items)`.
  - Receipt history table showing timestamped entry by operator.
- **What Must Be Visible**:
  - Receiving modal or inline line-item receipt inputs.
  - Progress progress bar indicator.
  - Timestamped receipt log entries showing date, received quantity, and notes.
- **Caption**: *"Track partial or full inventory receipts line-by-line with complete receiving history logs."*

---

## Screenshot 6: Stocky & Spreadsheet CSV Import

- **Screen Name**: Stocky CSV Data Migration
- **Target URL**: `https://admin.shopify.com/store/YOUR-STORE/apps/podesk/app/imports`
- **Shopify App Store Purpose**: Migration & Onboarding Screenshot.
- **Sample Data Needed**:
  - Mode: `File upload` or `Paste CSV`.
  - Header mapping preview showing auto-detected columns: `Handle -> handle`, `Supplier -> supplier_name`, `Supplier SKU -> supplier_sku`, `Cost -> cost_price`.
  - Preview summary: `24 valid rows ready to import`, `0 invalid rows`.
- **What Must Be Visible**:
  - Step progress bar: `1. Select File -> 2. Map Columns -> 3. Preview & Import`.
  - Column dropdown override controls.
  - Downloadable sample CSV button (`Download sample CSV`).
- **Caption**: *"Effortlessly import suppliers and SKU mappings from Stocky or spreadsheets with auto-detected CSV mapping."*
