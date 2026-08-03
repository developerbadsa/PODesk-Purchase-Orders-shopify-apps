# Production Readiness Checklist for PODesk

Product: **PODesk: Purchase Orders**  
Target Environment: Node.js 20+ / Docker Container / Managed PostgreSQL  
Document Status: Technical Release Specification  

---

## 1. Production Hosting & Infrastructure

- [x] **Hosting Provider**: Deployed to Vercel production server (`https://podesk-purchase-orders.vercel.app`).
- [x] **Runtime Environment**: Node.js `20.19.0` or `>=22.12.0` (matching `package.json` engines directive).
- [x] **SSL / HTTPS Certificate**: Active SSL certificate on Vercel (`https://podesk-purchase-orders.vercel.app`).
- [x] **Process Management**: Serverless function deployment powered by `@react-router/serve` build pipeline.
- [x] **Domain & Callback Configuration**: Updated App URL and OAuth redirect URIs (`/auth/callback` and `/api/auth`) in `shopify.app.toml` and documentation.

---

## 2. Production Database

- [x] **Database Engine**: Managed PostgreSQL instance with SSL connection enforced (`sslmode=require`).
- [x] **Connection Pooling**: Configured Prisma client connection pool with strict connection timeouts.
- [x] **Migration Deployment**: Applied migration `20260803000000_init_postgres`.
- [x] **Database Backups**: Automated daily snapshot backups with point-in-time recovery (PITR) enabled.

---

## 3. Environment Variables Specification

Ensure all required production environment variables are configured securely:

```bash
# Shopify App Credentials
SHOPIFY_API_KEY="your_production_shopify_client_id"
SHOPIFY_API_SECRET="your_production_shopify_client_secret"
SCOPES="read_inventory,read_locations,read_orders,read_products"

# App Public Domain & Port
HOST="https://app.podesk.io"
PORT="3000"
NODE_ENV="production"

# Database Connection
DATABASE_URL="postgresql://user:password@production-db-host:5432/podesk_production?sslmode=require"

# Error Monitoring (Optional/Recommended)
SENTRY_DSN="https://your_sentry_dsn_here"
```

---

## 4. Webhooks & GDPR Compliance

- [x] `app/uninstalled` endpoint configured to invalidate sessions and schedule store data purge. (Status: **Configured**)
- [x] `app/scopes_update` endpoint configured to track scope permissions. (Status: **Configured**)
- [x] Mandatory GDPR Privacy Webhook Handlers:
  - `POST /webhooks/privacy/customers/data_request` (Returns 200 acknowledgment; PODesk stores no customer PII). (Status: **Configured**)
  - `POST /webhooks/privacy/customers/redact` (Returns 200 acknowledgment; PODesk stores no customer PII). (Status: **Configured**)
  - `POST /webhooks/privacy/shop/redact` (Triggers shop session deletion and cascades store entity purge). (Status: **Configured**)

---

## 5. Application Logging & Error Monitoring

- [ ] **Structured Logging**: Configure JSON formatted logger to stdout for easy aggregation in CloudWatch, Datadog, or Logtail.
- [ ] **Error Capture**: Integrate Sentry SDK or Bugsnag to capture uncaught server-side loader/action exceptions and client-side React Router error boundaries.
- [ ] **Sensitive Data Scrubbing**: Ensure OAuth tokens, database URLs, and API secrets are redacted from error logs.

---

## 6. API Rate Limits & Sync Scalability Controls

- [x] **Shopify GraphQL Query Costs**: Sync actions use top-level `productVariants` cursor pagination to avoid nested query cost limit breaches.
- [x] **Page Batching**: Product sync is capped at 1,000 products per sync job (40 pages × 25 items/page). Order sync is capped at 1,000 orders (10 pages × 25 items/page).
- [ ] **Background Job Queue**: For catalogs exceeding 5,000 SKUs or high-volume stores, implement a background worker queue (e.g. Redis + BullMQ or Cloudflare Queues) to run Shopify GraphQL Bulk Operations asynchronously without HTTP request timeouts.

---

## 7. Security Audit & Upstream Advisory Status

> [!WARNING]
> **Production Launch Security Policy**: `npm audit` reports high-severity security advisories originating from upstream `@react-router/*` dependencies within the official `@shopify/shopify-app-react-router` template.
> 
> **Rule**: Do NOT run `npm audit fix --force`. Doing so installs incompatible major package versions that break the Shopify React Router application scaffold architecture.
> 
> **Action**: Production deployment is held until Shopify or React Router maintains safe, backward-compatible patch releases.

---

## 8. Pre-Release Verification & QA Requirements

Prior to submitting to the Shopify App Store or deploying to production, execute the following verification steps:

- [x] **Automated Builds**: `npm run typecheck`, `npm run lint`, `npm run build`, and `npx prisma validate` pass cleanly with zero errors.
- [x] **Clean Workspace**: `git diff --check` reports no whitespace issues or unresolved merge markers.
- [x] **Manual Browser QA**: Executed complete manual QA test pass across Dashboard, Suppliers, Mappings, Purchase Orders, PO Receiving, Reorder Table, Settings, and Stocky CSV Import (`product/launch/LIVE_QA_REPORT.md`).
- [ ] **Screenshot & Video Assets**: Capture retina screenshot pack and record 3-minute demo video using realistic test store data.

---

## 9. Release Rollback Strategy

1. **Git Tagging**: Tag every release commit (e.g. `git tag -a v1.0.0-beta -m "Initial Launch Candidate"`).
2. **Database Migrations**: Ensure all Prisma migrations are strictly additive (avoid dropping columns in single deployments) so that previous code versions can operate if rollback occurs.
3. **Container Rollback**: Maintain previous Docker container image builds in the container registry to allow instant 1-click rollback on hosting platform if critical runtime issues arise.
