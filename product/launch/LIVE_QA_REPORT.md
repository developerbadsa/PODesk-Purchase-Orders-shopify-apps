# PODesk Live QA & Deployment Verification Report

Last Updated: 2026-08-06  
Product: **PODesk: Purchase Orders**  
Live Hosted Application URL: `https://podesk-purchase-orders.vercel.app`  
Database Engine: Managed PostgreSQL (`prisma/migrations/20260803000000_init_postgres`)  

---

## 1. Live Public Route Verification (HTTP Status Checks)

All 9 public routes and brand assets were verified via automated HTTP requests against the live production deployment `https://podesk-purchase-orders.vercel.app`:

| Route / Asset URL | Target Content | HTTP Status | Content-Type Header | Result |
|---|---|---|---|---|
| `https://podesk-purchase-orders.vercel.app/` | App Root & Merchant Login Form | `200 OK` | `text/html` | **PASS** |
| `https://podesk-purchase-orders.vercel.app/privacy` | Privacy Policy Document | `200 OK` | `text/html` | **PASS** |
| `https://podesk-purchase-orders.vercel.app/terms` | Terms of Service Document | `200 OK` | `text/html` | **PASS** |
| `https://podesk-purchase-orders.vercel.app/data-deletion` | Data Deletion Protocol | `200 OK` | `text/html` | **PASS** |
| `https://podesk-purchase-orders.vercel.app/support` | Support Portal Main View | `200 OK` | `text/html` | **PASS** |
| `https://podesk-purchase-orders.vercel.app/support/getting-started` | Onboarding Guide | `200 OK` | `text/html` | **PASS** |
| `https://podesk-purchase-orders.vercel.app/support/troubleshooting` | Merchant Troubleshooting | `200 OK` | `text/html` | **PASS** |
| `https://podesk-purchase-orders.vercel.app/brand/podesk-app-icon.png` | Retina App Icon PNG Asset | `200 OK` | `image/png` | **PASS** |
| `https://podesk-purchase-orders.vercel.app/brand/podesk-logo-horizontal.png` | Horizontal Brand Logo PNG Asset | `200 OK` | `image/png` | **PASS** |

---

## 2. Live Shopify OAuth & Install QA Protocol

### Test Sequence
1. Open production root `https://podesk-purchase-orders.vercel.app/`.
2. Enter test store domain (`test-store-fgyympec.myshopify.com`).
3. Submit form to initiate OAuth flow (`/auth/login`).
4. Shopify OAuth authorization prompt displays requesting permissions (`read_products`, `read_inventory`, `read_locations`, `read_orders`).
5. Click **Install app** / Approve permissions.
6. OAuth callback (`/auth/callback`) exchanges authorization code for shop offline access token and persists session in PostgreSQL.
7. Redirects to Shopify Admin embedded view (`/app`).
8. Validate App Bridge embedded navigation bar with 8 items:
   - Dashboard (`/app`)
   - Suppliers (`/app/suppliers`)
   - SKU mappings (`/app/mappings`)
   - Purchase orders (`/app/purchase-orders`)
   - Reorder planning (`/app/reorder`)
   - Stocky import (`/app/imports`)
   - Settings (`/app/settings`)
   - Billing (`/app/billing`)
9. Verify no iframe breakout or redirect loops occur.
10. Confirm 0 runtime errors (500) in Vercel logs.

**Install Result**: **PASS (Ready for Live Beta Testing)**

---

## 3. Core Feature QA Verification Matrix

| Workflow Module | Key Verification Actions | Status | Notes |
|---|---|---|---|
| **A. Dashboard & Sync** | Trigger **Sync Shopify inventory**. Products, variants, and locations populate in DB. No GraphQL cost limits breached. Metric cards update. | **PASS** | Cursor-based pagination handles batching. Last sync timestamp updates. |
| **B. Suppliers** | Create supplier (*Apex Apparel Ltd*, lead time 14, min order 250, Net 30). Edit lead time to 21. Archive and restore supplier. | **PASS** | Full CRUD and archiving state transitions persist in PostgreSQL. |
| **C. SKU Mappings** | Map 5+ synced SKUs to Apex Apparel Ltd. Assign custom supplier SKU, unit cost ($18.50), lead time override. Set primary supplier. | **PASS** | Mappings reflect correctly in reorder tables and PO autofill. |
| **D. Purchase Orders** | Create draft PO for Apex Apparel Ltd. Prefill unit costs. Progress status: `DRAFT` -> `SENT` -> `CONFIRMED`. Line editing locks on non-draft. Duplicate PO. Print view layout check. Open supplier email draft from PO detail. | **PASS** | Print stylesheet outputs clean branded PO headers with settings data. Email draft opens in the user's mail client with supplier recipient, subject, and message prefilled. |
| **E. Receiving** | Record partial receipt against `CONFIRMED` PO. Status becomes `PARTIALLY_RECEIVED`. Record remainder. Status updates to `RECEIVED`. | **PASS** | Full receipt history and progress percentages calculated dynamically. |
| **F. Reorder Planning** | Filter sales velocity windows (7d/14d/30d/90d). Adjust buffer and target stock days. Save manual override quantity with reason note. Multi-select same supplier rows to generate multi-line draft PO. | **PASS** | Manual overrides accurately replace suggested quantities in draft PO generation. |
| **G. CSV / Stocky Import** | Download sample CSV (`podesk-supplier-sku-import-sample.csv`). Upload sample CSV. Preview column detection and invalid row warnings. Execute import. | **PASS** | Column detection maps headers dynamically. Invalid rows exported cleanly. |
| **H. Settings** | Update company name, contact email, currency code (`USD`), address, PO prefix (`PO-`). Save and verify across PO creation and print layout. | **PASS** | Settings persist and format currency/prefix globally. |

---

## 4. Vercel Logs & Error Handling Assessment

- **HTTP Status Monitoring**: 0 server errors (500/502/504) observed on live endpoints.
- **Database Connectivity**: Prisma PostgreSQL connection succeeds with SSL enabled (`sslmode=require`).
- **Prisma Schema Verification**: Migrations are applied (`20260803000000_init_postgres`). Schema is fully in sync.
- **Shopify API Initialization**: API credentials (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`) initialize without token or configuration errors.

---

## 5. Manual QA Session Notes

| Date | Area | Store / Context | Result | Evidence |
|---|---|---|---|---|
| 2026-08-06 | Purchase order supplier email draft | `test-store-fgyympec.myshopify.com`, PO detail page | **PASS** | Clicking **Open email draft** opens the local mail composer and pre-fills the supplier recipient, subject (`Purchase Order PO-20260806-123547-K161 from test-store-fgyympec.myshopify.com`), and email body with PO reference and expected arrival date. |
| 2026-08-06 | Purchase order line items and sent status | `test-store-fgyympec.myshopify.com`, PO `PO-20260806-123547-K161` | **PASS** | Added a PO line item successfully, removed a PO line item successfully, and marked the purchase order as sent. The PO detail view updated to `SENT`, sent count changed to `1 time(s)`, and receiving inputs became available. |

## 6. Summary of Launch Status & Remaining Blockers

- **Hosted Web Server & Public Pages**: 100% Ready (Vercel Live).
- **Production PostgreSQL Database**: 100% Ready.
- **Shopify OAuth & Auth Contract**: 100% Configured (`shopify.app.toml` & `AUTH_AND_DEPLOYMENT_CHECKLIST.md`).
- **Core MVP Application Workflows**: 100% Verified.
- **App Store Submission Blockers**:
  1. Retina Screenshots (1280x800 px) for App Store listing draft.
  2. 2-3 Minute MP4 Demo Video recording.
