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
| Shopify OAuth/session | Done | Scaffold authentication exists. Needs real dev-store test. |
| Database schema | Ongoing | Core Prisma models exist. Additional models needed for mapping/import/settings. |
| Inventory sync | Ongoing | First sync action exists. Needs pagination, error handling, and real-store testing. |
| Supplier management | Ongoing | Create/list exists. Edit/delete not done. |
| Purchase orders | Ongoing | Basic create/list exists. Detail/edit/multiple lines/export not done. |
| Reorder table | Ongoing | Basic risk list exists. Proper formula/settings not done. |
| Stocky import | Ongoing | Placeholder page exists. CSV import not done. |
| Billing | Not Started | Shopify billing not implemented. |
| App Store listing | Not Started | Strategy exists. Assets not built. |
| Sales materials | Ongoing | Outreach copy exists. Demo/video/case study not done. |
| GitHub repo | Done | Main branch pushed to GitHub remote. |

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
| Test with development store | Not Started | Install succeeds on a real Shopify dev store. |
| Confirm required scopes | Ongoing | Scopes are limited to read products, inventory, locations, orders. |
| Uninstall cleanup test | Not Started | Uninstall webhook is verified. |

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

Tasks:

| Task | Status | Acceptance Criteria |
|---|---|---|
| Sync products | Ongoing | Products save with Shopify product ID, title, handle, status, vendor. |
| Sync variants | Ongoing | Variants save with SKU, barcode, inventory item ID, cost, tracked flag. |
| Sync locations | Ongoing | Active locations save with Shopify location ID. |
| Sync inventory levels | Ongoing | Inventory saves per variant/location. |
| Sync recent orders | Ongoing | Recent order quantities calculate SKU sales velocity. |
| Add pagination | Not Started | Sync handles stores beyond first 50 products/100 orders. |
| Add sync progress UI | Not Started | Merchant sees sync running, complete, or failed. |
| Add sync error logging | Not Started | Failed API responses are saved and visible to developer. |
| Add resync safety | Not Started | Duplicate products/variants are not created. |

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
| Create supplier | Ongoing | Supplier form saves name, email, phone, lead time, terms, notes. |
| List suppliers | Ongoing | Dashboard shows supplier count and recent suppliers. |
| Supplier edit | Not Started | Merchant can update supplier fields. |
| Supplier delete/archive | Not Started | Merchant can remove inactive supplier without breaking old POs. |
| Supplier detail page | Not Started | Merchant can see supplier metadata and related SKUs/POs. |
| SKU-to-supplier mapping | Not Started | Merchant can map Shopify variants to suppliers. |
| Supplier import from CSV | Not Started | CSV can create suppliers with preview and validation. |

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
| Create basic PO | Ongoing | PO can be created with supplier, SKU, quantity, expected date, notes. |
| List recent POs | Ongoing | Dashboard shows recent POs with status and supplier. |
| PO reference generator | Ongoing | PO reference is generated automatically. |
| Multiple line items | Not Started | One PO can contain multiple SKUs. |
| PO detail page | Not Started | Merchant can view complete PO and line details. |
| Edit draft PO | Not Started | Merchant can edit draft before sending. |
| Update PO status | Not Started | Merchant can move PO through draft/sent/confirmed/received/delayed/cancelled. |
| Duplicate PO | Not Started | Merchant can repeat common supplier orders faster. |
| Export PO PDF | Not Started | Merchant can download supplier-ready PO. |
| Email PO to supplier | Later | Only after PDF/export is stable. |

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
| Basic stockout risk list | Ongoing | Dashboard shows SKUs with low days-left values. |
| Reorder table screen | Not Started | Dedicated table supports search/filter/sort. |
| Configurable sales window | Not Started | Merchant can select 7/14/30/90 days. |
| Lead time in risk formula | Not Started | Supplier lead time affects reorder urgency. |
| Manual buffer days | Not Started | Merchant can set safety buffer. |
| Suggested reorder quantity | Not Started | App suggests quantity based on target days and velocity. |
| Exclude OOS days | Not Started | Formula does not punish products that were out of stock. |
| Manual override | Not Started | Merchant can override suggested quantity. |

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
| Stocky import page | Ongoing | Placeholder page exists. |
| Migration checklist copy | Ongoing | Landing and outreach content exists. |
| CSV upload | Not Started | Merchant can upload CSV securely. |
| CSV preview | Not Started | Merchant sees first rows before import. |
| Column mapping | Not Started | Merchant maps CSV columns to PODesk fields. |
| Supplier import | Not Started | CSV creates supplier records. |
| SKU-supplier import | Not Started | CSV maps SKUs to suppliers when data exists. |
| PO history import | Not Started | Import old POs when structure is usable. |
| Error report | Not Started | Invalid rows are shown with reasons. |
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

Turn beta usage into paid subscription revenue.

Tasks:

| Task | Status | Acceptance Criteria |
|---|---|---|
| Shopify billing integration | Not Started | Merchant can approve monthly charge. |
| Trial flow | Not Started | Trial state and expiry are clear. |
| Plan gating | Not Started | Starter/Pro/Business limits enforced simply. |
| Privacy policy | Not Started | Public policy page exists. |
| Terms of service | Not Started | Public terms page exists. |
| Data deletion workflow | Not Started | Merchant uninstall/data request can be handled. |
| Error monitoring | Not Started | Production errors are captured. |
| Background job queue | Not Started | Sync/import can run without request timeout. |

Definition of done:

- Merchant can install, activate, start trial, approve billing, and continue using the app without founder intervention.

## Phase 9: App Store Listing

Objective:

Make Shopify App Store listing clear enough to convert high-intent merchant searches.

Tasks:

| Task | Status | Acceptance Criteria |
|---|---|---|
| App title | Done | `PODesk: Purchase Orders`. |
| Subtitle | Done | `Inventory reorder alerts`. |
| Short description | Not Started | Uses purchase order, supplier, reorder, Stocky migration language. |
| Long description | Not Started | Explains problems, features, onboarding, pricing clearly. |
| Screenshots | Not Started | Show actual product screens, not abstract graphics. |
| Demo video | Not Started | Shows real workflow in under 3 minutes. |
| Category/tags | Not Started | App classified under accurate inventory/order management tags. |
| Review request flow | Not Started | Ask activated happy users after successful PO creation/import. |

Definition of done:

- Listing is ready for review and does not overpromise unsupported features.

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
- purchase order PDF/email workflow
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
| 3 | Run install/setup/typecheck after repo push. | Not Started |
| 4 | Test Shopify install on development store. | Not Started |
| 5 | Fix inventory sync pagination and error handling. | Not Started |
| 6 | Build supplier edit/archive screen. | Not Started |
| 7 | Build SKU-to-supplier mapping. | Not Started |
| 8 | Build PO detail/edit/multiple line items. | Not Started |
| 9 | Build reorder table screen with configurable windows. | Not Started |
| 10 | Build CSV upload/preview/mapping for Stocky/spreadsheet import. | Not Started |

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
