# PODesk

PODesk is a Shopify embedded app focused on inventory reordering, purchase orders, suppliers, and Stocky migration.

Public app title:

> PODesk: Purchase Orders

Launch campaign:

> Stocky Rescue by PODesk

## Current Build

This repo now contains the official Shopify React Router app scaffold plus the first PODesk MVP shell.

## Planning Docs

- [FEATURES.md](FEATURES.md) - professional feature specification, MVP boundary, screens, data model, and App Store positioning.
- [WORK_PLAN.md](WORK_PLAN.md) - execution tracker with Done, Ongoing, Not Started, phase plan, and next tasks.
- [APP_PLAN.md](APP_PLAN.md) - long-form product strategy and roadmap archive.
- [docs/APP_NAME_DECISION.md](docs/APP_NAME_DECISION.md) - final naming decision and rationale.

Implemented:

- Shopify React Router embedded app scaffold
- Prisma session storage
- Prisma models for stores, synced products/variants, inventory locations, suppliers, purchase orders, and PO lines
- Dashboard route
- Shopify product, variant, inventory, location, and recent order sync action
- Basic 30-day sales velocity and stockout-risk calculation
- Supplier creation form
- Basic purchase-order creation form
- Stocky/spreadsheet supplier CSV import
- Product, strategy, and sales planning docs

Not implemented yet:

- Stocky SKU mapping and PO archive import
- PO PDF export
- billing
- app-store submission setup
- automatic Shopify inventory write-back
- alerts
- real receiving workflow

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

