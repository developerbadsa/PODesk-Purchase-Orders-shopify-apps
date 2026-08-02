# PODesk Changelog

## 2026-08-02

- Locked public app name as `PODesk: Purchase Orders`.
- Added Shopify React Router embedded app scaffold with Prisma session storage.
- Added store, product, variant, location, supplier, SKU mapping, purchase order, and PO line data models.
- Built the dashboard with Shopify inventory sync, setup progress, operations snapshot, reorder attention, and recent PO sections.
- Verified development-store install inside `test-store-fgyympec.myshopify.com`.
- Verified Shopify sync with 17 products, 26 variants, and 2 locations.
- Fixed stale scope handling and documented dev reinstall steps for access-denied errors.
- Reduced Shopify GraphQL query cost by using smaller product/order pages and disabling nested location-level inventory sync in the dashboard action.
- Reworked inventory sync to use top-level `productVariants` cursor pagination so large products are not capped at the first 100 variants.
- Added supplier management: create, list, edit, archive, restore, delete, and detail view.
- Added SKU-to-supplier mappings with supplier SKU, cost, lead-time override, and primary supplier support.
- Added purchase order print workflow (`/app/purchase-orders/:id/print`) with business document layout, `@media print` styling, and store-scoped access.
- Hardened purchase order lifecycle and production readiness:
  - Added PO reference editing for DRAFT POs with store-scoped duplicate checking.
  - Enforced strict status transition state machine (blocking invalid state jumps and locking terminal `RECEIVED`/`CANCELLED` states).
  - Added `updatedAt` activity timestamp tracking across PO detail, PO list, and print views.
  - Updated PO duplicate action to create a new draft PO and redirect directly to the new PO detail view.
  - Restricted PO deletion strictly to DRAFT POs.
- Added persistent `StoreSettings` database model (scoped by store ID) for company profile, purchase order defaults, and localization.
- Built `/app/settings` route with server-side input validation (`currencyCode`, `contactEmail`, `poNumberPrefix`) and save notice.
- Connected settings to PO creation with custom reference prefixes and auto-populating default PO notes.
- Upgraded PO print view (`/app/purchase-orders/:id/print`) into a professional branded PO document with merchant address header, payment terms, currency formatting, and footer.
- Formatted purchase order totals dynamically on list and detail views using store settings currency.
- Added `ImportJob` and `ImportJobRow` database models for store-scoped CSV import tracking.
- Built RFC-4180 compliant CSV parser (`app/imports.server.ts`) supporting quoted fields, escaped quotes, CRLF/LF line endings, auto-header detection, 1 MB max file size, and 1,000 max row limit.
- Rebuilt `/app/imports` route into a full multi-step CSV import tool supporting file upload (`.csv`) or text paste, column mapping auto-detection, merchant override, row validation preview, row-isolated import execution, and job history.
- Integrated CSV supplier mapping import status into dashboard setup progress.
- Built professional Purchase Order export and supplier email workflow:
  - Extended `PurchaseOrder` database schema with `lastSentAt`, `supplierEmailSnapshot`, and `sentCount` fields and applied Prisma migration `20260802094034_add_po_supplier_sharing_fields`.
  - Added interactive "Supplier sharing" section on PO detail route (`/app/purchase-orders/$id`) with prefilled default subject (`Purchase Order {PO_REFERENCE} from {COMPANY_NAME}`), message template, and editable supplier email snapshot.
  - Implemented client-side copy buttons for email, subject, and message text using `navigator.clipboard`.
  - Added `mailto:` draft launcher and target="_blank" printable PO link.
  - Implemented store-scoped `mark-sent` server action: updates `DRAFT` PO status to `SENT`, records `lastSentAt` timestamp, increments `sentCount`, validates email input, and blocks `CANCELLED`/`RECEIVED` orders.
  - Updated PO list table (`/app/purchase-orders`) to show last sent date and sent count.
  - Built Purchase Order Receiving Workflow:
  - Added `PurchaseOrderReceipt` and `PurchaseOrderReceiptLine` database models and applied Prisma migration `20260802100011_add_po_receipts`.
  - Added per-line and PO-level receiving calculations (`orderedQuantity`, `receivedQuantity`, `remainingQuantity`, `receivingStatus`, `receiveProgressPercent`, `canReceive`).
  - Added store-scoped `record-receipt` server action on `/app/purchase-orders/$id` with strict validation (blocking `DRAFT`/`RECEIVED`/`CANCELLED` states, validating positive integer input boundaries, ensuring items don't exceed remaining quantities, and automatically updating PO status to `RECEIVED` or `PARTIALLY_RECEIVED`).
  - Added Receiving UI section on PO detail page with progress bar, summary metrics, contextual state banners, date picker, notes input, and per-line receive quantity input table.
  - Added Receipt History log table on PO detail view displaying receipt date, SKU breakdown with received quantities, total quantity, and notes.
  - Updated PO list table (`/app/purchase-orders`) to show compact receiving progress (`X / Y received (Z%)`).
  - Updated Dashboard (`/app`) recent purchase orders table with receiving progress.
  - Added dedicated receiving utility (`app/receiving.server.ts`) with `calculateLineReceiving`, `getPoReceivingSummary`, and `canReceivePo` functions.
- Built Manual Reorder Quantity Overrides & Calculation Module:
  - Added `ReorderOverride` database model (scoped to storeId + variantId) and executed Prisma migration `20260802172219_add_reorder_override`.
  - Extracted reorder calculation functions into `app/reorder.server.ts` (`calculateReorderRecommendation`, `getRiskLevel`, `getRiskReason`, `getFinalSuggestedQuantity`) preparing structure for future out-of-stock days exclusion.
  - Added `save-override` and `clear-override` server actions in `/app/reorder` with integer validation, 300-char note limits, and store-scoped upserts/deletions.
  - Updated loader on `/app/reorder` to return formula suggested quantity, manual override quantity, final suggested quantity, override badge state, and explicit risk reasons ("Already out of stock", "Stock may run out before supplier lead time + buffer", "Stock is low but not urgent", "Stock OK", "No recent sales").
  - Updated "Create draft PO" action to use `finalSuggestedQty` and hide action when `finalSuggestedQty <= 0`.
  - Added multi-row draft PO creation from reorder planning table:
    - Added checkboxes per row for items with active mapped suppliers and `finalSuggestedQty > 0`.
    - Built bulk action toolbar displaying selected count, shared supplier badge, and single-supplier validation warning.
    - Implemented server-side `create-multi-reorder-po` action: validates store scoping, supplier equality, positive quantity boundaries, creates multi-line draft PO with max lead time expected arrival, and redirects directly to `/app/purchase-orders/$id`.
  - Upgraded merchant risk reason calculations in `app/reorder.server.ts` to show exact strings ("Map supplier first", "Already out of stock", "Stock may run out before supplier lead time + buffer", "Stock is low but not urgent", "Stock OK", "No recent sales").
  - Built downloadable sample CSV resource route (`app/routes/app.imports.sample-csv.ts`) serving `podesk-supplier-sku-import-sample.csv` with standard headers and sample rows, connected to a "Download sample CSV" button on `/app/imports`.
  - Built store-scoped invalid import rows export route (`app/routes/app.imports.invalid-csv.$id.ts`) serving `invalid-rows-{jobId}.csv` with original row data plus `error_reason`, connected to "Download invalid rows" buttons on preview and import history cards.
  - Upgraded contextual user-friendly empty states with clear CTAs across `/app/suppliers`, `/app/mappings`, `/app/purchase-orders`, `/app/reorder`, and `/app/imports`.
  - Created complete product sales, marketing, and QA asset suite in `product/assets/`:
    - `app-store-listing.md`: Listing copy, subtitles, key benefits, feature bullets, search keywords, screenshot requirements, support placeholders, and video outline.
    - `demo-script.md`: 3-minute video walk-through script covering sync, mapping, reorder overrides, multi-row POs, print output, receiving, and CSV imports.
    - `screenshot-plan.md`: Visual capture plan for 10 key app screens with target data, merchant problem proofs, and captions.
    - `outreach-messages.md`: Honest outreach copy including cold emails for Stocky users, community replies, Reddit DMs, partner messages, follow-ups, and demo call invites.
    - `manual-test-checklist.md`: 12-point manual browser testing protocol covering all key merchant workflows.
- Verified local `npm run typecheck`, `npm run lint`, and `npm run build`.

## Current MVP Limits

- Location-level inventory quantities are not synced in the dashboard action. Build this later with Shopify bulk operations or a dedicated low-cost inventory job.
- Historical PO import from Stocky/spreadsheets is not built yet (CSV Supplier and SKU mapping import is complete).
- Direct automated SMTP/provider email sending and PDF download remain future work (manual email sharing, mailto drafts, and printable POs are complete).
- Production Shopify subscription billing is scaffolded; charges are not enforced in dev build.
- App Store listing copy/assets are drafted in `product/assets/`; final screenshots and recorded demo video still need to be produced after browser testing.
- `npm audit` still reports high-severity dependency advisories that require careful dependency upgrades, not blind force-fix.

# Shopify Template History

This project started from Shopify's React Router app template. Original template history is kept below for dependency context.

# @shopify/shopify-app-template-react-router

## 2026.01.08
- [#170](https://github.com/Shopify/shopify-app-template-react-router/pull/170) - Update React Router minimum version to v7.12.0

## 2025.12.11

- [#151](https://github.com/Shopify/shopify-app-template-react-router/pull/151) Update `@shopify/shopify-app-react-router` to v1.1.0 and `@shopify/shopify-app-session-storage-prisma` to v8.0.0, add refresh token fields (`refreshToken` and `refreshTokenExpires`) to Session model in Prisma schema, and adopt the `expiringOfflineAccessTokens` flag for enhanced security through token rotation. See [expiring vs non-expiring offline tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens#expiring-vs-non-expiring-offline-tokens) for more information.

## 2025.10.10

- [#95](https://github.com/Shopify/shopify-app-template-react-router/pull/95) Swap the product link for [admin intents](https://shopify.dev/docs/apps/build/admin/admin-intents).

## 2025.10.02

- [#81](https://github.com/Shopify/shopify-app-template-react-router/pull/81) Add shopify global to eslint for ui extensions

## 2025.10.01

- [#79](https://github.com/Shopify/shopify-app-template-react-router/pull/78) Update API version to 2025-10.
- [#77](https://github.com/Shopify/shopify-app-template-react-router/pull/77) Update `@shopify/shopify-app-react-router` to V1.
- [#73](https://github.com/Shopify/shopify-app-template-react-router/pull/73/files) Rename @shopify/app-bridge-ui-types to @shopify/polaris-types

## 2025.08.30

- [#70](https://github.com/Shopify/shopify-app-template-react-router/pull/70/files) Upgrade `@shopify/app-bridge-ui-types` from 0.2.1 to 0.3.1.

## 2025.08.17

- [#58](https://github.com/Shopify/shopify-app-template-react-router/pull/58) Update Shopify & React Router dependencies.  Use Shopify React Router in graphqlrc, not shopify-api
- [#57](https://github.com/Shopify/shopify-app-template-react-router/pull/57) Update Webhook API version in `shopify.app.toml` to `2025-07`
- [#56](https://github.com/Shopify/shopify-app-template-react-router/pull/56) Remove local CLI from package.json in favor of global CLI installation
- [#53](https://github.com/Shopify/shopify-app-template-react-router/pull/53) Add the Shopify Dev MCP to the template

## 2025.08.16

- [#52](https://github.com/Shopify/shopify-app-template-react-router/pull/52) Use `ApiVersion.July25` rather than `LATEST_API_VERSION` in `.graphqlrc`.

## 2025.07.24

- [14](https://github.com/Shopify/shopify-app-template-react-router/pull/14/files) Add [App Bridge web components](https://shopify.dev/docs/api/app-home/app-bridge-web-components) to the template.

## July 2025

Forked the [shopify-app-template repo](https://github.com/Shopify/shopify-app-template-remix)

# @shopify/shopify-app-template-remix

## 2025.03.18

-[#998](https://github.com/Shopify/shopify-app-template-remix/pull/998) Update to Vite 6

## 2025.03.01

- [#982](https://github.com/Shopify/shopify-app-template-remix/pull/982) Add Shopify Dev Assistant extension to the VSCode extension recommendations

## 2025.01.31

- [#952](https://github.com/Shopify/shopify-app-template-remix/pull/952) Update to Shopify App API v2025-01

## 2025.01.23

- [#923](https://github.com/Shopify/shopify-app-template-remix/pull/923) Update `@shopify/shopify-app-session-storage-prisma` to v6.0.0

## 2025.01.8

- [#923](https://github.com/Shopify/shopify-app-template-remix/pull/923) Enable GraphQL autocomplete for Javascript

## 2024.12.19

- [#904](https://github.com/Shopify/shopify-app-template-remix/pull/904) bump `@shopify/app-bridge-react` to latest
-
## 2024.12.18

- [875](https://github.com/Shopify/shopify-app-template-remix/pull/875) Add Scopes Update Webhook
## 2024.12.05

- [#910](https://github.com/Shopify/shopify-app-template-remix/pull/910) Install `openssl` in Docker image to fix Prisma (see [#25817](https://github.com/prisma/prisma/issues/25817#issuecomment-2538544254))
- [#907](https://github.com/Shopify/shopify-app-template-remix/pull/907) Move `@remix-run/fs-routes` to `dependencies` to fix Docker image build
- [#899](https://github.com/Shopify/shopify-app-template-remix/pull/899) Disable v3_singleFetch flag
- [#898](https://github.com/Shopify/shopify-app-template-remix/pull/898) Enable the `removeRest` future flag so new apps aren't tempted to use the REST Admin API.

## 2024.12.04

- [#891](https://github.com/Shopify/shopify-app-template-remix/pull/891) Enable remix future flags.

## 2024.11.26

- [888](https://github.com/Shopify/shopify-app-template-remix/pull/888) Update restResources version to 2024-10

## 2024.11.06

- [881](https://github.com/Shopify/shopify-app-template-remix/pull/881) Update to the productCreate mutation to use the new ProductCreateInput type

## 2024.10.29

- [876](https://github.com/Shopify/shopify-app-template-remix/pull/876) Update shopify-app-remix to v3.4.0 and shopify-app-session-storage-prisma to v5.1.5

## 2024.10.02

- [863](https://github.com/Shopify/shopify-app-template-remix/pull/863) Update to Shopify App API v2024-10 and shopify-app-remix v3.3.2

## 2024.09.18

- [850](https://github.com/Shopify/shopify-app-template-remix/pull/850) Removed "~" import alias

## 2024.09.17

- [842](https://github.com/Shopify/shopify-app-template-remix/pull/842) Move webhook processing to individual routes

## 2024.08.19

Replaced deprecated `productVariantUpdate` with `productVariantsBulkUpdate`

## v2024.08.06

Allow `SHOP_REDACT` webhook to process without admin context

## v2024.07.16

Started tracking changes and releases using calver
