# PODesk

PODesk is a Shopify embedded app focused on inventory reordering, purchase orders, suppliers, and Stocky migration.

Public app title:

> PODesk: Purchase Orders

Launch campaign:

> Stocky Rescue by PODesk

## Current Build

This repo now contains the official Shopify React Router app scaffold plus a working PODesk MVP.

## Planning & Launch Documentation

- [FEATURES.md](FEATURES.md) - professional feature specification, MVP boundary, screens, data model, and App Store positioning.
- [WORK_PLAN.md](WORK_PLAN.md) - execution tracker with Done, Ongoing, Not Started, phase plan, and next tasks.
- [PROJECT_STATUS.html](PROJECT_STATUS.html) - browser-friendly visual status dashboard for quick review.
- [APP_PLAN.md](APP_PLAN.md) - long-form product strategy and roadmap archive.
- [PRICING_STRATEGY.md](product/PRICING_STRATEGY.md) - active Free, Pro, and Growth pricing strategy.

### Launch Readiness & Public App Routes
- [/privacy](app/routes/privacy.tsx) - public Privacy Policy route (`/privacy`).
- [/terms](app/routes/terms.tsx) - public Terms of Service route (`/terms`).
- [/data-deletion](app/routes/data-deletion.tsx) - public Data Deletion Policy route (`/data-deletion`).
- [/support](app/routes/support._index.tsx) - public Merchant FAQ & Help Center route (`/support`).
- [/support/getting-started](app/routes/support.getting-started.tsx) - public 7-step onboarding guide (`/support/getting-started`).
- [/support/troubleshooting](app/routes/support.troubleshooting.tsx) - public troubleshooting guide (`/support/troubleshooting`).
- [SHOPIFY_APP_STORE_SUBMISSION_CHECKLIST.md](product/launch/SHOPIFY_APP_STORE_SUBMISSION_CHECKLIST.md) - master submission readiness tracker.
- [app-store-listing-final.md](product/launch/app-store-listing-final.md) - final App Store listing copy, scope justifications, and review notes.
- [privacy-policy.md](product/launch/privacy-policy.md) - draft privacy policy.
- [terms-of-service.md](product/launch/terms-of-service.md) - draft terms of service.
- [data-deletion-policy.md](product/launch/data-deletion-policy.md) - draft data deletion and retention policy.
- [screenshot-capture-pack.md](product/launch/screenshot-capture-pack.md) - screenshot production specification for 6 App Store visuals.
- [demo-video-shot-list.md](product/launch/demo-video-shot-list.md) - 2-3 minute demo video script and timeline.
- [PRODUCTION_READINESS.md](product/launch/PRODUCTION_READINESS.md) - infrastructure, hosting, database, env vars, and rollback spec.

### Merchant Support Docs (`product/support/`)
- [faq.md](product/support/faq.md) - merchant FAQ answering 11 common questions.
- [getting-started.md](product/support/getting-started.md) - 7-step onboarding guide from install to PO receipt.
- [troubleshooting.md](product/support/troubleshooting.md) - technical troubleshooting guide.

### Product & Outreach Assets (`product/assets/`)
- [outreach-messages.md](product/assets/outreach-messages.md) - cold email templates, forum replies, and demo invites.
- [podesk-supplier-sku-import-sample.csv](product/assets/podesk-supplier-sku-import-sample.csv) - sample CSV import template.

Implemented:

- Shopify React Router embedded app scaffold
- Prisma session storage & database models
- Dashboard route with metrics and Quick Actions
- Shopify product, variant, inventory, location, and recent order sync
- Reorder planning with 7/14/30/90-day velocity, buffer days, target days, risk reasons, manual reorder overrides, and multi-row PO creation
- Supplier CRUD (create, list, edit, detail, archive, restore, soft delete)
- SKU-to-supplier mapping with supplier SKU, unit cost, lead time, and primary supplier enforcement
- Purchase-order workflow (create, list, detail, status state machine, duplicate, print view)
- Purchase-order receiving workflow (partial/full receipts, progress bar, receipt history log)
- Supplier manual email & sharing workflow (pre-formatted templates, mailto launcher, printable PO, Mark as Sent tracking)
- Stocky/spreadsheet CSV import (file upload/paste, auto-detected headers, column mapping overrides, validation preview, invalid rows export)
- Settings route (business identity, purchasing defaults, prefix, currency)
- App Store submission assets, legal drafts, screenshot/video specs, production readiness guide, and support docs
- Mandatory GDPR Privacy Webhooks (`customers/data_request`, `customers/redact`, `shop/redact`)
- Public Legal & Support App Routes (`/privacy`, `/terms`, `/data-deletion`, `/support`, `/support/getting-started`, `/support/troubleshooting`)

Launch Status & Next Manual Actions:

- GDPR Privacy Webhooks: **Done** (Implemented in `app/routes/webhooks.privacy.tsx` & configured with `compliance_topics` in `shopify.app.toml`)
- Public Legal & Support App Routes: **Done** (Created public routes `/privacy`, `/terms`, `/data-deletion`, `/support`, `/support/getting-started`, `/support/troubleshooting`)
- Support Email: **Active** (`podeskapp@gmail.com`)
- Public Legal URL Hosting: **Needs Production Domain** (App routes implemented; requires production HTTPS domain)
- App Store Listing Copy & Scope Justification: **Done** (Final draft in `product/launch/`)
- Screenshot & Video Production Plans: **Done** (Specs ready in `product/launch/`)
- Actual Screenshots: **Not Started** (Requires manual QA capture on populated test store)
- Actual Demo Video: **Not Started** (Requires manual recording from test store)
- Production Hosting & Deployment: **Not Started** (Requires hosting platform & HTTPS domain)
- Billing Enforcement: **Postponed / Free Beta** (App is listed as 100% free during initial launch)
- Security Audit Advisory: **Blocked** (Blocked until safe React Router / Shopify app template dependency patch)

## Local Setup

Install dependencies:

```bash
npm install
```

Generate Prisma client and create the local SQLite database:

```bash
npm run setup
```

Start Shopify app dev:

```bash
npm run dev
```

Shopify Partner login and a development store are required for `npm run dev`.

### Dev Troubleshooting: Scope / Permission Errors

If sync fails with `"Access denied for products field"` or `"Access denied for locations field"`:

1. Press `q` in the terminal to stop the dev server.
2. Open Shopify Admin on your development store, go to **Settings > Apps and sales channels**, and **uninstall PODesk**.
3. Reset CLI dev configuration:
   ```bash
   npm run dev -- --reset
   ```
4. Select your Partner organization and development store.
5. Accept the updated permission prompt when opening the app preview.
6. Open the app and click **Sync Shopify inventory** again on the dashboard.

This permission error occurs when a development store holds a stale token generated before required scopes (`read_products,read_inventory,read_locations,read_orders`) were set in `shopify.app.toml`.

## Product Guardrails

Do not turn this into a full ERP in the first version.

The first product must prove:

1. Shopify inventory can sync reliably.
2. Merchants can recreate suppliers.
3. Merchants can create simple purchase orders.
4. Merchants can see which SKUs need reorder attention.
5. Stocky migration/import pain is real enough to pay for.

## Security & Known Launch Blockers

> [!WARNING]
> **Production Release Blocker**: `npm audit` reports high-severity security advisories stemming from upstream `@react-router/*` / Shopify app scaffold dependencies.
> Do NOT run `npm audit fix --force` as it causes breaking architectural changes to `@shopify/shopify-app-react-router`.
> Production launch is blocked until Shopify / React Router releases safe, compatible patch updates.
