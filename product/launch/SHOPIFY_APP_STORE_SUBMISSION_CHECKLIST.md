# Shopify App Store Submission Checklist for PODesk

Last updated: 2026-08-02
Product: PODesk: Purchase Orders
App Status: Beta / Launch Preparation

This checklist tracks all submission requirements mandated by Shopify for listing **PODesk: Purchase Orders** on the Shopify App Store.

---

## 1. Submission Status Summary

| Area | Status | Notes |
|---|---|---|
| Core App MVP Features | Done | Sync, suppliers, SKU mapping, PO workflow, receiving, reorder planning, CSV import. |
| App Store Listing Draft | Done | Final copy, scope justifications, and review notes in `product/launch/app-store-listing-final.md`. |
| Public Legal Copy Drafts | Done | Draft Privacy Policy, Terms of Service, and Data Deletion Policy created in `product/launch/`. |
| Production Readiness Spec | Done | Deployment, env vars, database, and webhook guidelines created in `product/launch/PRODUCTION_READINESS.md`. |
| Screenshot & Video Strategy | Done | Capture pack and 3-minute video shot list designed in `product/launch/`. |
| User & Support Documentation | Done | FAQ, Getting Started, and Troubleshooting guides written in `product/support/`. |
| Actual Screenshots | Needs Work | Screenshots must be captured from a populated test store with realistic data. |
| Actual Demo Video | Needs Work | 2–3 minute video recording and voiceover required. |
| GDPR Webhooks Implementation | Done | Webhook handler for `customers/data_request`, `customers/redact`, and `shop/redact` implemented in `app/routes/webhooks.privacy.tsx` and subscribed with `compliance_topics` in `shopify.app.toml`. |
| Public Legal & Support App Routes | Done | `/privacy`, `/terms`, `/data-deletion`, `/support`, `/support/getting-started`, `/support/troubleshooting`, and `/brand/*` routes verified returning 200 OK. |
| Production Webhost & HTTPS Setup | Done | Live host `https://podesk-purchase-orders.vercel.app` provisioned with active SSL and PostgreSQL backend. |
| Manual QA Pass | Done | Browser QA across desktop/mobile viewports executed (`product/launch/LIVE_QA_REPORT.md`). Final verification pass completed on 2026-08-06. |
| Security & Dependency Audit | Blocked | `npm audit` reports high React Router vulnerability from Shopify app template dependencies. Launch blocked until upstream safe patch. |
| Production Billing Enforcement | Later | App is 100% free during initial launch beta. Billing scaffold exists but is intentionally unenforced. |

---

## 2. Required App Setup

- [x] **App Name**: `PODesk: Purchase Orders` configured in `shopify.app.toml`. (Status: **Done**)
- [x] **App Scopes**: `read_inventory,read_locations,read_orders,read_products` configured. (Status: **Done**)
- [x] **Production App URLs**: Production HTTPS domain (`https://podesk-purchase-orders.vercel.app`) and OAuth redirect URLs (`/auth/callback` and `/api/auth`) configured. (Status: **Done**)
- [x] **Embedded Admin Configuration**: Verified loading inside Shopify Admin frame over HTTPS. (Status: **Done**)

---

## 3. Required Public URLs

- [x] **App Landing Page / Public Home**: HTTPS URL `https://podesk-purchase-orders.vercel.app/` with brand header and shop login form. (Status: **Done**)
- [x] **Privacy Policy URL**: Hosted at `/privacy` returning status 200 OK. (Status: **Done**)
- [x] **Terms of Service URL**: Hosted at `/terms` returning status 200 OK. (Status: **Done**)
- [x] **Data Deletion Policy URL**: Hosted at `/data-deletion` returning status 200 OK. (Status: **Done**)
- [x] **Support / Help Docs URL**: Hosted at `/support` returning status 200 OK. (Status: **Done**)

---

## 4. Required Legal Pages

- [x] **Privacy Policy**: Covers store data read, SKU mappings, PO records, no selling data, no inventory write-backs, retention, contact info. (Status: **Done (Draft)**)
- [x] **Terms of Service**: Covers free beta status, limitation of liability, merchant responsibility for reorders, read-only inventory, future paid tier notice. (Status: **Done (Draft)**)
- [x] **Data Deletion Policy**: Covers uninstall handling, deletion timeframe (30 days), deleted data categories, backup snapshot retention. (Status: **Done (Draft)**)

---

## 5. Required Screenshots & Demo Media

- [x] **Screenshot Capture Spec**: Detailed target screens, sample data, and captions in `product/launch/screenshot-capture-pack.md`. (Status: **Done**)
- [ ] **Actual Screenshot PNGs**: Capture 1280x800 px screenshots of Dashboard, Reorder Table, Suppliers, Mappings, POs, and Import. (Status: **Needs Work**)
- [x] **Demo Video Shot List**: 2–3 minute script and timeline specified in `product/launch/demo-video-shot-list.md`. (Status: **Done**)
- [ ] **Actual Demo Video Recording**: Record MP4 demo video showing sync, supplier setup, SKU mapping, reorder overrides, PO creation, print/share, receiving, and Stocky CSV import. (Status: **Needs Work**)

---

## 6. Support Contact & Credentials

- [x] **Support Contact Email**: `podeskapp@gmail.com` is active and ready for merchant support. (Status: **Done**)
- [ ] **Test Store Credentials**: Dedicated Shopify Partner development test store prepared with sample products and orders for Shopify reviewers. (Status: **Needs Work**)

---

## 7. App Scopes Justification

| Scope | Purpose & Justification |
|---|---|
| `read_products` | Access product titles, SKUs, barcodes, variants, and product images for purchase order line items and SKU mapping. |
| `read_inventory` | Access current inventory levels and inventory item IDs to calculate stockout risks and suggested reorder quantities. |
| `read_locations` | Map inventory stocking locations and assign correct stocking destinations to purchase orders. |
| `read_orders` | Analyze recent order sales velocity over 7/14/30/90 day historical windows to compute accurate reorder quantity recommendations. |

*Note*: No `write_inventory` scope is requested. PODesk is read-only regarding Shopify stock in the initial release to eliminate accidental stock mutation risk.

---

## 8. Webhook Status

- [x] `app/uninstalled` configured in `shopify.app.toml`. (Status: **Done**)
- [x] `app/scopes_update` configured in `shopify.app.toml`. (Status: **Done**)
- [x] GDPR mandatory webhook handler configured in `shopify.app.toml` & `app/routes/webhooks.privacy.tsx`:
  - `customers/data_request` (Returns 200 acknowledgment; PODesk stores no customer PII). (Status: **Done**)
  - `customers/redact` (Returns 200 acknowledgment; PODesk stores no customer PII). (Status: **Done**)
  - `shop/redact` (Deletes shop session and cascades store data deletion). (Status: **Done**)

---

## 9. Billing Decision

- [x] **Free Beta Model**: App is listed as 100% free during beta period. (Status: **Done**)
- [x] **Billing Integration**: Non-blocking `BillingSubscription` database model and presentation UI exist at `/app/billing`. Subscription billing enforcement is intentionally deferred. (Status: **Later**)

---

## 10. Manual QA Checklist

- [x] Install app on fresh development store. (Status: **Done**)
- [x] Trigger **Sync Shopify inventory** and verify products, variants, and sales velocity populate cleanly. (Status: **Done**)
- [x] Create a new supplier and configure company contact info. (Status: **Done**)
- [x] Map 5+ SKUs to the supplier with custom supplier SKUs, unit costs, and lead times. (Status: **Done**)
- [x] Open `/app/reorder`, adjust sales window and buffer days, set a manual reorder override, and verify suggested quantities update correctly. (Status: **Done**)
- [x] Select multiple at-risk SKUs for a single supplier and create a multi-row draft PO. (Status: **Done**)
- [x] Open PO detail page, edit notes/arrival date, copy supplier email text, and preview print page. (Status: **Done**)
- [x] Record a partial item receipt on the PO and verify receiving progress bar and status update to `PARTIALLY_RECEIVED`. (Status: **Done**)
- [x] Upload and paste a CSV file on `/app/imports`, verify column auto-detection and row validation preview, and execute import. (Status: **Done**)
- [x] Uninstall app from test store and confirm clean cleanup without database orphans. (Status: **Done**)

---

## 11. Security & Dependency Audit Status

- [ ] `npm audit` check: **BLOCKED**. High-severity advisory reported in React Router / Shopify App React Router template dependencies (`@react-router/*`).
- **Policy**: Do NOT force fix (`npm audit fix --force`) as it breaks core `@shopify/shopify-app-react-router` scaffold architecture.
- **Action Plan**: Wait for official Shopify / React Router safe patch release before production deployment.

---

## 12. Production Hosting Checklist

- [x] Select cloud hosting platform (Vercel Production Host). (Status: **Done**)
- [x] Provision managed PostgreSQL instance with daily snapshots. (Status: **Done**)
- [x] Configure environment variables (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES`, `DATABASE_URL`, `NODE_ENV`). (Status: **Done**)
- [x] Configure HTTPS SSL certificate for production app domain (`https://podesk-purchase-orders.vercel.app`). (Status: **Done**)
- [x] Setup application monitoring and error tracking. (Status: **Done**)
