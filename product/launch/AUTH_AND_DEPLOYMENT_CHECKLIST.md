# Shopify Auth & Deployment Verification Checklist for PODesk

Product: **PODesk: Purchase Orders**  
Live Host: `https://podesk-purchase-orders.vercel.app`  
Framework: React Router 7 + `@shopify/shopify-app-react-router` + Prisma PostgreSQL  

---

## 1. Required Vercel Environment Variables

Ensure the following 6 environment variables are configured in Vercel (**Project Settings -> Environment Variables**):

| Variable Name | Required Production Value | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | Prisma Postgres production connection string (enforce SSL). |
| `SHOPIFY_API_KEY` | `d13330e0e34d870c16ebaf279dcd54d1` | Client ID from Shopify Partner Dashboard. |
| `SHOPIFY_API_SECRET` | `shpss_...` | Client Secret from Shopify Partner Dashboard. |
| `SHOPIFY_APP_URL` | `https://podesk-purchase-orders.vercel.app` | Canonical HTTPS URL of the hosted app. |
| `SCOPES` | `read_products,read_inventory,read_locations,read_orders` | Comma-separated Shopify OAuth access scopes. |
| `NODE_ENV` | `production` | Enables production optimisations and strict security modes. |

---

## 2. Shopify Partner Dashboard Configuration

### App URL
```text
https://podesk-purchase-orders.vercel.app
```

### Allowed Redirection URL(s)
```text
https://podesk-purchase-orders.vercel.app/auth/callback
https://podesk-purchase-orders.vercel.app/api/auth
```
*Note: `@shopify/shopify-app-react-router` uses `/auth/callback` under `authPathPrefix: "/auth"`. Including both ensures backward compatibility across Shopify CLI dev tools and production OAuth redirects.*

---

## 3. Route Behavior & OAuth Protocol Flow

1. **Root Entry (`/`)**:
   - Accepts manual shop domain entry (e.g., `my-store.myshopify.com`).
   - Auto-redirects to `/app` if embedded params (`shop`, `host`, `embedded`, `id_token`) are present.
2. **Auth Initiation (`/auth/login`)**:
   - Submits shop domain to `login(request)` helper.
   - Initiates Shopify OAuth consent redirect.
3. **OAuth Handler (`/auth/*` & `/auth/callback`)**:
   - Managed by `app/routes/auth.$.tsx` calling `authenticate.admin(request)`.
   - Exchanges code for offline access token and saves session to PostgreSQL (`Session` table).
4. **Protected Embedded Application (`/app`)**:
   - Protected by `authenticate.admin(request)` in `app/routes/app.tsx`.
   - Validates session token / iframe header inside Shopify Admin.
   - Renders embedded navigation and sub-routes (`/app/suppliers`, `/app/mappings`, `/app/reorder`, `/app/purchase-orders`, `/app/imports`, `/app/settings`, `/app/billing`).

---

## 4. Local vs. Production Behavior Differences

| Aspect | Local Development (`npm run dev`) | Production (`Vercel`) |
|---|---|---|
| **Server Engine** | Vite Dev Server + Cloudflare Tunnel | Vercel Serverless Function (`@react-router/serve` build) |
| **App URL** | Dynamically generated Cloudflare tunnel URL | Static domain (`https://podesk-purchase-orders.vercel.app`) |
| **CLI Config Sync** | `shopify app dev` auto-updates URLs | URLs fixed in Shopify Partner Dashboard |
| **Database** | Local / Dev Postgres | Production Prisma Postgres instance |
| **Session Persistence** | `Session` model in Prisma Postgres | `Session` model in Prisma Postgres |

---

## 5. Common Failure Symptoms & Fix Protocol

### Symptom A: `FUNCTION_INVOCATION_FAILED` (Vercel 500)
- **Root Cause**: Missing env var (e.g. `SHOPIFY_API_KEY` or `DATABASE_URL`), or Prisma migration/connection error at serverless startup.
- **Fix Steps**:
  1. Check Vercel Function Logs under **Deployments -> Logs**.
  2. Verify all 6 env vars exist in Vercel Project Settings.
  3. Ensure database is reachable (`DATABASE_URL`) with `sslmode=require`.
  4. Run `npx prisma migrate deploy` to ensure remote PostgreSQL schema is current.

### Symptom B: Missing `apiKey` / `apiSecretKey` Error
- **Root Cause**: `SHOPIFY_API_KEY` or `SHOPIFY_API_SECRET` not loaded in `app/shopify.server.ts`.
- **Fix Steps**:
  1. Confirm variable names match exact casing (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`).
  2. Re-deploy on Vercel after setting variables (serverless functions require redeploy to pick up new env vars).

### Symptom C: `Redirect URI mismatch` / `Oauth error invalid_request`
- **Root Cause**: Shopify Partner Dashboard redirect URL does not match the URL requested by the app.
- **Fix Steps**:
  1. Open **Shopify Partner Dashboard -> Apps -> PODesk: Purchase Orders -> Configuration**.
  2. Add `https://podesk-purchase-orders.vercel.app/auth/callback` to **Allowed redirection URL(s)**.
  3. Save changes and retry login flow.

### Symptom D: App Loads Outside Iframe (Broke out of Shopify Admin)
- **Root Cause**: Unauthenticated request triggered window redirect instead of App Bridge redirect.
- **Fix Steps**:
  1. Ensure route is nested under `/app` layout in `app/routes/app.tsx`.
  2. Verify `AppProvider` in `app/routes/app.tsx` has `embedded` prop set and passes valid `apiKey`.

### Symptom E: Stale Dev Store OAuth Token / Scope Mismatch
- **Root Cause**: Dev store has older session stored with outdated scope permissions in Prisma DB.
- **Fix Steps**:
  1. Uninstall PODesk app from the test store via **Shopify Admin -> Settings -> Apps and sales channels**.
  2. Clear stale session rows for test shop domain in PostgreSQL `Session` table if needed.
  3. Re-install app by launching OAuth flow from `https://podesk-purchase-orders.vercel.app/`.
