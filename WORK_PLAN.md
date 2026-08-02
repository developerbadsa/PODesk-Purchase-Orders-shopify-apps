# PODesk Work Plan

Date: 2026-08-02

## Purpose

This file is the execution tracker for PODesk.

Use this file daily to answer four questions:

1. What is done?
2. What is ongoing?
3. What has not been touched?
4. What should be built next?

The goal is not to build a huge app. The goal is to ship a narrow Shopify app that a real merchant can install, understand, trust, and pay for.

## Current Product Goal

PODesk must help Shopify merchants:

- sync Shopify inventory
- manage suppliers
- create purchase orders
- see what needs to be reordered
- recover key Stocky/spreadsheet workflows

Professional sales goal:

> Sell a clear operational result: fewer stockouts, fewer spreadsheet POs, cleaner supplier buying, and a practical migration path for Stocky users.

## Status Legend

| Status | Meaning |
|---|---|
| Done | Implemented in code or written as a completed planning asset. |
| Ongoing | Started, but still incomplete or untested. |
| Not Started | No meaningful implementation yet. |
| Blocked | Cannot progress without credentials, store access, decision, or external dependency. |
| Later | Intentionally postponed. |

## Current Status Snapshot

| Area | Status | Notes |
|---|---|---|
| Final name | Done | `PODesk: Purchase Orders` is final. |
| Active folder | Done | Use `C:\A-Drive-Backup\Projects\shopify\shopify apps\PODesk`. |
| Shopify scaffold | Done | React Router Shopify scaffold exists. |
| Shopify OAuth/session | Done | Dev-store install and embedded admin loading verified. |
| Database schema | Done | Core models + SupplierVariantMapping + isArchived added. |
| Inventory sync | Done (verified) | Dev-store sync verified on 2026-08-02: 17 products, 26 variants, 2 locations. Query cost issue fixed with smaller product/order pages. |
| Supplier management | Done (verified) | Full CRUD: create, list, edit, archive, restore, delete, detail page. Browser workflow tested during MVP verification. |
| SKU-supplier mapping | Done (verified) | SupplierVariantMapping model, create/delete/update mappings, supplier SKU/cost/lead override, multiple suppliers per SKU, primary supplier enforcement. Store scope hardened. |
| Purchase orders | Done (verified) | Multi-line PO create, detail, draft reference editing, status state machine, duplicate redirect, delete draft, print view, and activity timestamps. Store scope hardened. |
| PO Receiving | Done (verified) | PurchaseOrderReceipt & PurchaseOrderReceiptLine models, per-line and PO-level receiving calculations, record-receipt server action, partial/full receive status transitions (PARTIALLY_RECEIVED / RECEIVED), receipt history log, list page progress, dashboard integration, and print view summary. |
| Settings & Branded Output | Done (verified) | Store-scoped business identity, purchasing defaults, prefix customization, currency formatting, and merchant-branded PO output. |
| Reorder table | Done (verified) | Dedicated page with 7/14/30/90d window, buffer, target days, risk classification, exact risk reasons, formula suggested qty, manual reorder overrides (ReorderOverride model), extracted app/reorder.server.ts calculations, multi-row draft PO creation for matching suppliers, and single-row/multi-row PO actions using final suggested qty. |
| Stocky import | Done (verified) | Full CSV supplier and SKU mapping import with file/paste, column detection, manual column override, preview validation, import execution, job history, downloadable sample CSV (podesk-supplier-sku-import-sample.csv), and store-scoped invalid rows export. |
| Legal Pages (Drafts) | Done | Public Privacy Policy, Terms of Service, and Data Deletion Policy drafts completed in `product/launch/`. |
| Public Legal & Support App Routes | Done | Created public routes `/privacy`, `/terms`, `/data-deletion`, `/support`, `/support/getting-started`, `/support/troubleshooting`. |
| GDPR Privacy Webhooks | Done | Implemented `customers/data_request`, `customers/redact`, and `shop/redact` in `app/routes/webhooks.privacy.*` & subscribed in `shopify.app.toml`. |
| Support Email Placeholder | Assigned | `support@podesk.app` assigned across docs and public routes; needs active mailbox setup prior to launch. |
| Public Legal URL Hosting | Needs Production Domain | Public app routes implemented; requires production HTTPS deployment. |
| App Store Listing Draft | Done | Final copy, scope justifications, review notes, and submission checklist completed in `product/launch/`. |
| Production Readiness Spec | Done | Production hosting, env vars, database, backup, rate limit, and rollback spec written in `product/launch/PRODUCTION_READINESS.md`. |
| Merchant Support Docs | Done | FAQ, Getting Started guide, and Troubleshooting guide written in `product/support/`. |
| Screenshot/Video Plans | Done | 6-screenshot capture spec and 3-minute video shot list designed in `product/launch/`. |
| Actual Screenshots | Not Started | Needs manual QA capture on populated test store. |
| Actual Demo Video | Not Started | Needs manual video recording on test store. |
| Production Hosting | Not Started | Hosting deployment and live HTTPS domain configuration pending. |
| Billing | Postponed (Free Beta) | App is free during launch beta. BillingSubscription model and plan overview route (`/app/billing`) exist as non-blocking presentation scaffold. |
| Sales materials | Done | Professional cold emails, community forum replies, Reddit DMs, partner outreach, and demo call invites built in `product/assets/outreach-messages.md`. |
| GitHub repo | Done | Main branch pushed to GitHub remote. |
| Local verification | Done | Setup, prisma migrate, typecheck, lint, build all passed. |
| Security audit | Blocked | High React Router vulnerabilities in Shopify app template dependencies. Launch blocker until safe upstream patch is available; do not force-fix blindly. |

## Phase 0: Foundation And Repo

Objective:

Make the project clean, named correctly, trackable, and ready for disciplined work.

Tasks:

| Task | Status | Acceptance Criteria |
|---|---|---|
| Finalize public name | Done | App name is `PODesk: Purchase Orders`. |
| Rename active folder | Done | Active folder is `PODesk`. |
| Update Shopify config name | Done | `shopify.app.toml` uses `PODesk: Purchase Orders`. |
| Update package name | Done | `package.json` uses `podesk`. |
| Create feature specification | Done | `FEATURES.md` exists and separates MVP/later features. |
| Create work tracker | Done | `WORK_PLAN.md` exists and tracks Done/Ongoing/Not Started. |
| Update README links | Done | README points to product plan files. |
| Initialize git repo | Done | `.git` exists inside `PODesk`. |
| Add GitHub remote | Done | Remote points to `developerbadsa/PODesk-Purchase-Orders-shopify-apps`. |
| Push main branch | Done | Code is pushed to GitHub. |

Definition of done:

- GitHub repo has clean first commit.
- README explains product, setup, and planning docs.
- Old `ReorderPilot` folder is ignored and not used.

Risk:

Windows still has a lock on the old `ReorderPilot` folder. Do not work there.

## Phase 1: Shopify App Install And Auth

Objective:

Merchant can install PODesk and open it inside Shopify admin.

Tasks:

| Task | Status | Acceptance Criteria |
|---|---|---|
| Shopify app scaffold | Done | App starts from official Shopify React Router scaffold. |
| Embedded app route | Done | `/app` route loads after authentication. |
| Session persistence | Done | Prisma session model exists. |
| App navigation | Done | Dashboard and Stocky import links exist. |
| Test with development store | Done | App installs, opens, grants required scopes, and loads inside `test-store-fgyympec.myshopify.com`. |
| Confirm required scopes | Done | Scopes are limited to read products, inventory, locations, orders. No write_inventory scope. |
| Uninstall cleanup test | Not Started | Uninstall webhook is verified. |

Verification note, 2026-08-02 (Audit & Hardening):

- `npm run setup`: Passed.
- `npm run typecheck`: Passed.
- `npm run lint`: Passed.
- `npm run build`: Passed.
- Store scope & DRAFT status verification: Hardened across all route forms and action handlers.
- Shopify development-store install: Passed. App loads in Shopify admin and sync completed with 17 products, 26 variants, and 2 locations.

Do not build:

- custom login
- team accounts
- permissions
- standalone merchant portal

Definition of done:

- Install, open, refresh, uninstall, reinstall all work without manual database fixes.

## Phase 2: Inventory Sync

Objective:

PODesk can read Shopify inventory data reliably enough to support purchase orders and reorder suggestions.

Known limitations:

- Variant sync now uses top-level `productVariants` cursor pagination instead of nested product variant reads. This avoids the old 100-variants-per-product ceiling and keeps the sync query cost safer for larger catalogs.
- Location-level inventory quantities are intentionally not synced in the dashboard action. The previous nested inventory-level query exceeded Shopify's single-query cost limit. Build this later with Shopify bulk operations or a dedicated low-cost inventory job.

Tasks:

| Task | Status | Acceptance Criteria |
|---|---|---|
| Sync products | Done | Products save with Shopify product ID, title, handle, status, vendor. Cursor-based pagination, up to 1000 products. |
| Sync variants | Done | Variants save with SKU, barcode, inventory item ID, cost, tracked flag. |
| Sync locations | Done | Active locations save with Shopify location ID. |
| Sync inventory levels | Later | Disabled in dashboard sync to avoid Shopify GraphQL query-cost failures. |
| Sync recent orders | Done | Recent order quantities calculate SKU sales velocity with conservative order and line-item pages. |
| Add pagination | Done | Products (25/page x 40 pages) and orders (25/page x 10 pages) paginated with cursor. |
| Add sync progress UI | Done | Button shows syncing state, success/error message with counts. |
| Add sync error logging | Done | GraphQL errors caught and displayed. Server-side console.error for debugging. |
| Add resync safety | Done | All upserts are idempotent. Repeated sync does not create duplicates. |

Definition of done:

- 500+ variants sync without duplicate records.
- inventory numbers match Shopify admin for sampled SKUs.
- sync failure gives useful error, not a blank screen.

Risk:

Wrong inventory data destroys trust. Accuracy beats speed.

## Phase 3: Supplier System

Objective:

Merchant can rebuild and maintain supplier records without spreadsheets.

Tasks:

| Task | Status | Acceptance Criteria |
|---|---|---|
| Create supplier | Done | Supplier form saves name, email, phone, lead time, terms, notes. Dedicated /app/suppliers page. |
| List suppliers | Done | /app/suppliers shows active and archived suppliers with PO and mapping counts. |
| Supplier edit | Done | /app/suppliers/:id detail page allows editing all fields. |
| Supplier delete/archive | Done | Archive (soft delete) and restore. Hard delete only if no POs reference the supplier. |
| Supplier detail page | Done | Shows edit form, mapped SKUs, purchase order history. |
| SKU-to-supplier mapping | Done | /app/mappings page. SupplierVariantMapping model with supplier SKU, cost, lead time override, multiple suppliers per SKU, and one primary supplier enforced per variant. |
| Supplier import from CSV | Done | CSV creates/reuses suppliers through `/app/imports` with preview, validation, and import history. |

Definition of done:

- Merchant can add a supplier and map products to that supplier without support.

Risk:

Without SKU mapping, PODesk cannot become a true reorder product.

## Phase 4: Purchase Order System

Objective:

Merchant can replace spreadsheet purchase orders with a simple PO workflow.

Tasks:

| Task | Status | Acceptance Criteria |
|---|---|---|
| Create basic PO | Done | /app/purchase-orders page. Multi-line PO creation with up to 5 lines at once. |
| List POs | Done | /app/purchase-orders shows all POs with status badges, cost totals, supplier, dates. |
| PO reference generator | Done | Auto-generated PO-{timestamp} reference. |
| Multiple line items | Done | PO creation supports 5 initial lines. Detail page supports adding more lines. |
| PO detail page | Done | /app/purchase-orders/:id shows full PO with lines, costs, subtotals. |
| Edit draft PO | Done | Draft POs allow editing notes, arrival date, adding/removing lines. |
| Update PO status | Done | Status buttons for all 7 states: draft/sent/confirmed/partially received/received/delayed/cancelled. |
| Duplicate PO | Done | One-click duplicate creates new draft PO from existing. |
| Manual supplier email & share workflow | Done | Merchant can copy email/subject/message, launch mailto draft, open printable PO, and track lastSentAt and sentCount with Mark as Sent action. |
| Automated SMTP email sending | Later | Direct background email delivery remains future work. |

Definition of done:

- Merchant can create, view, edit, and export a real supplier PO.

Risk:

If PO creation is slower than a spreadsheet, merchants will not keep using it.

## Phase 5: Reorder Logic

Objective:

PODesk tells merchants what needs attention and what quantity to consider buying.

Tasks:

| Task | Status | Acceptance Criteria |
|---|---|---|
| Basic stockout risk list | Done | Dashboard shows top 10 at-risk SKUs. |
| Reorder table screen | Done | /app/reorder with full table, risk summary, supplier/risk filters. |
| Configurable sales window | Done | 7/14/30/90 day selector in URL params. |
| Lead time in risk formula | Done | Supplier lead time from mapping or supplier default used in risk classification. |
| Manual buffer days | Done | Adjustable buffer days parameter. |
| Suggested reorder quantity | Done | Calculated from target days × avg daily sales − current stock. |
| Create PO from suggestion | Done | Mapped reorder suggestions can create a draft purchase order with final suggested quantity (respecting manual overrides) and expected arrival based on lead time. |
| Reorder calculation helper extraction | Done | Extracted reorder recommendation, risk level, risk reason, and final quantity logic into app/reorder.server.ts. |
| Manual override | Done | ReorderOverride model, save-override and clear-override server actions, override input, clear action, and "Manual override" badge in reorder table. |
| Exclude OOS days | Not Started | Logic structure prepared in app/reorder.server.ts. Exclude out-of-stock days when historical stock data becomes available. |

Definition of done:

- Merchant can open reorder table and create a PO from reorder suggestions.

Risk:

Wrong reorder suggestions will cause churn. Keep formula transparent and editable.

## Phase 6: Stocky / Spreadsheet Migration

Objective:

Turn Stocky discontinuation into a practical acquisition wedge.

Tasks:

| Task | Status | Acceptance Criteria |
|---|---|---|
| Stocky import page | Done | `/app/imports` is a working import tool, not a placeholder. |
| Migration checklist copy | Ongoing | Landing and outreach content exists. Dedicated public landing page still not built. |
| CSV upload | Done | Merchant can upload `.csv` file up to 1 MB. |
| CSV paste | Done | Merchant can paste raw CSV text. |
| CSV preview | Done | Merchant sees row validation before import. |
| Column mapping | Done | App auto-detects columns and merchant can override mapping before import. |
| Supplier import | Done | CSV creates/reuses supplier records with validation. |
| SKU-supplier import | Done | CSV maps synced Shopify SKUs to suppliers when data is valid. |
| PO history import | Not Started | Import old POs when structure is usable. |
| Error report | Done | Invalid rows are shown with row-level reasons and skipped safely. |
| Assisted migration flow | Not Started | Founder can manually review and complete messy imports. |

Definition of done:

- A Stocky/spreadsheet merchant can upload data, preview it, import usable rows, and understand what failed.

Risk:

Stocky exports may be messy. Sell "assisted migration" instead of promising perfect automation.

## Phase 7: Paid Beta

Objective:

Get real stores using PODesk and prove willingness to pay.

Tasks:

| Task | Status | Acceptance Criteria |
|---|---|---|
| Create demo store | Not Started | Demo store has realistic products, suppliers, POs, low-stock examples. |
| Create 3-minute demo video | Not Started | Video shows sync, supplier, PO, reorder table, Stocky import direction. |
| Build landing page | Not Started | Page explains PODesk and includes demo/migration call CTA. |
| Prepare support email | Not Started | Merchant can contact support. |
| Prepare onboarding script | Not Started | Demo call follows same steps every time. |
| Recruit first 10 merchants | Not Started | At least 10 qualified conversations or installs. |
| Charge first setup fee | Not Started | At least one merchant pays or commits to paid trial. |

Definition of done:

- 3 paying or committed beta merchants use PODesk with real store data.

Target:

- 3-7 serious beta users in first 90 days is more realistic than pretending this will instantly reach high MRR.

## Phase 8: Billing And Production Readiness

Objective:

Prepare production infrastructure, legal compliance, and rollout path.

Tasks:

| Task | Status | Acceptance Criteria |
|---|---|---|
| Privacy policy draft | Done | Public draft created in `product/launch/privacy-policy.md`. |
| Terms of service draft | Done | Public draft created in `product/launch/terms-of-service.md`. |
| Data deletion policy draft | Done | Public draft created in `product/launch/data-deletion-policy.md`. |
| Production readiness checklist | Done | Spec for hosting, env vars, database, webhooks in `product/launch/PRODUCTION_READINESS.md`. |
| Production hosting deployment | Not Started | Deploy container to cloud host with HTTPS domain. |
| Shopify billing enforcement | Postponed | App is 100% free during launch beta; billing scaffold preserved at `/app/billing`. |

## Phase 9: App Store Listing

Objective:

Complete launch readiness assets and submit to Shopify App Store.

Tasks:

| Task | Status | Acceptance Criteria |
|---|---|---|
| App Store submission checklist | Done | Master checklist created in `product/launch/SHOPIFY_APP_STORE_SUBMISSION_CHECKLIST.md`. |
| App Store final listing copy | Done | Completed in `product/launch/app-store-listing-final.md`. |
| Scope justification & review notes | Done | Scope justifications for read-only inventory access completed in `product/launch/app-store-listing-final.md`. |
| Screenshot capture pack | Done | 6-screenshot specification written in `product/launch/screenshot-capture-pack.md`. |
| Demo video shot list & script | Done | 3-minute script written in `product/launch/demo-video-shot-list.md`. |
| Merchant FAQ | Done | Written in `product/support/faq.md`. |
| Getting Started guide | Done | Written in `product/support/getting-started.md`. |
| Troubleshooting guide | Done | Written in `product/support/troubleshooting.md`. |
| Actual screenshots capture | Not Started | Capture retina PNG visuals from test store. |
| Actual demo video recording | Not Started | Record MP4 demo video with voiceover. |

## Phase 10: Growth To $10k MRR

Objective:

Reach roughly $10k MRR through narrow positioning and founder-led selling.

Practical path:

- 100 customers at $99/month
- 67 customers at $149/month
- 40 customers at $199/month plus migration fees

Core actions:

| Action | Status | Success Metric |
|---|---|---|
| Stocky migration landing page | Not Started | 5 qualified inbound leads/month. |
| Shopify Community helpful replies | Not Started | 20 high-quality replies/month. |
| Reddit/manual outreach | Not Started | 50 relevant messages/month. |
| Partner agency outreach | Not Started | 10 partner conversations/month. |
| Case studies | Not Started | 3 merchant stories published. |
| SEO pages | Not Started | 20 focused pages indexed. |

Definition of done:

- consistent inbound/outbound pipeline
- 20+ paying stores
- churn reasons tracked
- top 3 missing features clear from usage, not guesses

## Phase 11: Growth To $50k-$100k MRR

Objective:

Move from founder-led service to repeatable product-led growth.

Expansion features after traction:

- receiving workflow
- multi-location reorder planning
- automated supplier email delivery and PDF download
- weekly reorder report
- supplier performance report
- bulk edit and import tools
- better dead-stock reporting
- Shopify POS-focused workflows
- partner/agency referral program
- template marketplace for import mappings and PO templates

Do not expand until:

- at least 25 paying stores
- churn reasons are understood
- support burden is under control
- reorder recommendations are trusted

## Daily Execution Checklist

Every workday, update this section:

| Question | Answer |
|---|---|
| What did I build today? |  |
| What did I test today? |  |
| What merchant/sales work did I do today? |  |
| What is blocked? |  |
| What is tomorrow's single most important task? |  |

## Next 10 Tasks

This is the current priority order.

| # | Task | Status |
|---:|---|---|
| 1 | Update README with `FEATURES.md` and `WORK_PLAN.md` links. | Done |
| 2 | Initialize git repo and push clean first commit. | Done |
| 3 | Run install/setup/typecheck after repo push. | Done |
| 4 | Test Shopify install on development store. | Done |
| 5 | Fix inventory sync pagination and error handling. | Done |
| 6 | Build supplier CRUD (list/create/edit/archive/detail). | Done |
| 7 | Build SKU-to-supplier mapping. | Done |
| 8 | Build PO detail/edit/multiple line items/status/duplicate. | Done |
| 9 | Build reorder table with configurable windows and filters. | Done |
| 10 | Build CSV upload/preview/mapping for Stocky/spreadsheet import. | Done |
| 11 | Build PO receiving workflow. | Done |
| 12 | Build real Shopify billing approval/trial/plan enforcement. | Not Started |

## Hard Rules

- Do not build AI until at least $5k MRR and enough clean merchant data.
- Do not build automatic Shopify inventory write-back in MVP.
- Do not build accounting sync before the core PO workflow is used weekly.
- Do not add multi-marketplace support before Shopify use case is proven.
- Do not spend more time on naming.
- Do not code for a week without also doing sales work.
- Do not call the product a Stocky clone.
- Do not promise perfect migration.

## Research References

- Shopify Stocky migration: https://help.shopify.com/en/manual/products/inventory/transitioning-from-stocky
- Shopify Stocky note: https://help.shopify.com/en/manual/sell-in-person/shopify-pos/inventory-management/stocky
- Shopify App Store best practices: https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices
- Shopify App Store requirements: https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
- Shopify app listing categories: https://shopify.dev/docs/apps/launch/app-store-review/app-listing-categories
- Shopify inventory apps: https://shopify.dev/docs/apps/build/orders-fulfillment/inventory-management-apps
