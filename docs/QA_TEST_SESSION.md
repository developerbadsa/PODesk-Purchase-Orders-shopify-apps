# PODesk V1 QA Test Session

Date: August 6, 2026  
Store: `test-store-fgyympec.myshopify.com`  
Environment: Shopify embedded app on Vercel production  
Tester: Rahim Badsa  
Status: **In progress — Print fix deployed, QA continuing**

---

## QA Rules

- Track every test result in this file during the session.
- Mark each step as `PASS`, `FAIL`, `WARNING`, or `PENDING`.
- Any blank page, raw `200` text, auth loop, server error, or broken navigation is a blocking issue.
- Performance warnings do not block functional QA, but must be reviewed before final production release.

---

## Current Summary

| Area | Status | Notes |
| --- | --- | --- |
| Install and auth | ✅ PASS | App installed and dashboard loaded inside Shopify admin. No auth loop, blank page, or raw `200` screen. |
| Dashboard sync | ⚠️ WARNING | Sync completed but took ~50–60s for 17 products / 26 variants. Functional pass, performance warning. |
| Supplier flow | ✅ PASS | Supplier created, persisted after reload, archived, and restored. All OK. |
| SKU mappings | ✅ PASS | Mapping create/remove work. Replaced native dropdown with searchable variant picker. |
| Reorder planning | ✅ PASS | Reorder page renders. Manual override tested. Create PO from reorder works. |
| Purchase orders (list + create + detail) | ✅ PASS | Manual PO created. Totals correct. Duplicate warnings work. Detail page renders. |
| Print PO | ⚠️ FIX DEPLOYED | Auth error fixed (was opening new tab). Now uses in-frame nav + auto-print. **Needs retest after next deploy.** |
| Email review / send | ⏳ PENDING | Not tested yet. |
| Receiving | ⏳ PENDING | Not tested yet. |
| Stocky import | ⏳ PENDING | Not tested yet. |
| Settings | ⏳ PENDING | Not tested yet. |
| Responsive / slow network | ⏳ PENDING | Not tested yet. |
| Vercel / production logs | ⏳ PENDING | Monitor during each remaining flow. |

---

## What's Done ✅

| Feature | Result |
|---|---|
| Install & auth | PASS |
| Dashboard sync | PASS (performance warning ~50s) |
| Supplier create / archive / restore | PASS |
| SKU mapping create / edit / delete | PASS (searchable picker added) |
| Reorder planning + manual override + create PO | PASS |
| PO list + create + detail | PASS |
| Draft PO editing (add/remove lines, notes, ref) | PASS |
| PO status transitions | PASS |
| Print PO auth fix | FIX DEPLOYED — needs retest |

---

## What's Still Pending ⏳

| Feature | Notes |
|---|---|
| **Print PO retest** | After deploy — confirm in-frame nav + auto-print works |
| **Email review & send** | Copy subject/message + mailto draft + Mark as Sent |
| **Receiving** | Partial receive, full receive, over-receive block, receipt history |
| **Stocky CSV import** | Valid CSV, invalid CSV, preview, import confirmation |
| **Settings** | Persist company info, PO prefix, currency + secret masking |
| **Responsive / mobile layout** | Test at ≤480px and with slow network |
| **Vercel production logs** | Check for errors, auth failures, unhandled exceptions |

---

## Detailed Test Log

### 1. Install and Auth — `PASS`

- Opened Shopify admin app access screen.
- Installed/approved PODesk access.
- App redirected into embedded Shopify admin app.
- Dashboard loaded successfully. No raw `200` text, no blank screen, no auth loop.

---

### 2. Dashboard Sync — `WARNING`

- Clicked `Sync Shopify Inventory`. Loader appeared.
- Sync completed after about 50–60 seconds.

```
Basic MVP sync complete: synced 17 products, 26 variants, 2 locations. Orders scanned: 0.
```

- Functional behavior passed. Performance slower than expected.
- Likely causes: sequential API/DB upsert, Vercel cold start, Shopify Admin API latency.
- Action: Keep as performance warning for V1. Optimize batch writes later.

---

### 3. Supplier Flow — `PASS`

- Supplier created with name, email, phone, lead time, payment terms.
- Data persisted after page reload.
- Archive works — archived supplier appears separately with restore action.
- Restore works — supplier returns to active list.

---

### 4. SKU Mapping — `PASS`

- Mapping created successfully. Persists after reload.
- Duplicate mapping blocked with clear validation message.
- Remove action works.
- Native dropdown replaced with searchable variant picker — looks professional.

---

### 5. Reorder Planning — `PASS`

- Reorder page renders with synced/mapped SKUs.
- Suggested quantity, lead time, stock coverage, risk status all visible.
- Manual override saves and reflects correctly.
- Create PO from selected reorder row — works, redirects to PO detail.

---

### 6. Purchase Orders — `PASS`

- PO list renders. Manual PO created with success banner.
- Line items, subtotals, total cost all calculate correctly.
- Draft PO editing: add/remove lines, edit reference/notes/arrival — all work.
- Duplicate line item warning renders and does not crash.
- PO status lifecycle transitions (DRAFT → SENT etc.) work.
- PO detail page renders all line items, status, and supplier info correctly.

---

### 7. Print PO — `FAIL → FIX DEPLOYED — NEEDS RETEST`

**Problem observed:**
- Clicking "Print PO" opened a new browser tab outside Shopify iframe.
- New tab had no Shopify session → auth error / broken page with error message.

**Root cause:**
- All print links used `<a href="..." target="_blank">` — new tab = no embedded session.

**Fix applied:**
- Replaced all `<a target="_blank">` print links with React Router `<Link to=...>` in:
  - `app.purchase-orders.$id.tsx` (3 locations)
  - `app.purchase-orders._index.tsx` (1 location)
- Added `useEffect` on print page to auto-trigger `window.print()` after 500ms on load.
- Print page now loads within the Shopify iframe — auth works correctly.
- Print dialog pops up automatically. "← Back to PO" returns to PO detail.

**Retest checklist:**
- [ ] Click Print PO from PO detail — no new tab, no auth error
- [ ] Print page loads within Shopify admin iframe
- [ ] Print dialog opens automatically within ~1 second
- [ ] "Print / Save PDF" button re-triggers dialog
- [ ] "← Back to PO" navigation returns to PO detail page

---

### 8. Email Review and Send — `PENDING`

Test steps:
- Open PO detail page.
- Review generated supplier email subject and message.
- Test "Copy subject" and "Copy message" buttons.
- Test "Open email draft" (mailto link).
- Mark PO as Sent → confirm sent count and date update.
- (Optional) Configure SMTP/Resend in Settings, test direct email send.

Expected:
- Subject/message templates render with correct PO data.
- Copy buttons work in browser.
- mailto opens default email client.
- Mark as Sent updates PO status and sent metadata correctly.

---

### 9. Receiving — `PENDING`

Test steps:
- Move PO to SENT or CONFIRMED status.
- Receive partial quantity for some lines.
- Confirm remaining quantity updates correctly.
- Receive remaining quantity to complete the PO.
- Try over-receiving — should be blocked.
- Check receiving history log shows each receive event.

Expected:
- Partial receive → status becomes `PARTIALLY_RECEIVED`.
- Full receive → status becomes `RECEIVED`.
- Over-receiving is blocked with a clear error.
- Each receipt is logged with date, quantity, and notes.

---

### 10. Stocky Import — `PENDING`

Test steps:
- Open `Stocky import`.
- Download sample CSV template.
- Upload valid CSV with 2–3 mapped rows.
- Upload CSV with intentional errors (missing SKU, bad cost, unknown supplier name).
- Review import preview — confirm valid vs invalid row breakdown.
- Confirm imported supplier/mapping data appears in SKU mappings.

Expected:
- Valid rows import cleanly.
- Invalid rows are flagged per-row with reason.
- Import does not corrupt existing mappings.
- Import history log shows filename, date, and row counts.

---

### 11. Settings — `PENDING`

Test steps:
- Save company name, currency, PO prefix, default payment terms, and default PO notes.
- Reload settings page — confirm values persist.
- Save SMTP/Resend credentials.
- Reload — confirm secrets are masked (not visible).
- Save again with blank secret fields — confirm existing secrets are preserved (not wiped).

Expected:
- All settings persist after page reload.
- Sensitive credentials are never returned to the UI.
- Blank secret fields do not erase configured credentials.

---

### 12. Responsive and Slow Network — `PENDING`

Test steps:
- Test at mobile width (≤480px): dashboard, suppliers, mappings, reorder, PO detail, settings.
- Use Chrome DevTools network throttling (Slow 3G).
- Confirm loader appears and UI remains usable during slow requests.

Expected:
- No overlapping text or broken layout at mobile width.
- Forms remain usable on mobile.
- Loading states are clear and professional.

---

### 13. Production Logs — `PENDING`

Test steps:
- Open Vercel live logs while running remaining QA flows.
- Check logs after sync, PO create, receive, import.
- Open `/healthz` endpoint — confirm healthy response.

Expected:
- No fatal errors or unhandled exceptions.
- No repeated auth failures.
- Health endpoint reports healthy app and database.


## QA Rules

- Track every test result in this file during the session.
- Mark each step as `PASS`, `FAIL`, `WARNING`, or `PENDING`.
- Any blank page, raw `200` text, auth loop, server error, or broken navigation is a blocking issue.
- Performance warnings do not block functional QA, but must be reviewed before final production release.

## Current Summary

| Area | Status | Notes |
| --- | --- | --- |
| Install and auth | PASS | App installed and dashboard loaded inside Shopify admin. No auth loop, blank page, or raw `200` screen. |
| Dashboard sync | WARNING | Sync completed successfully but took about 50-60 seconds for 17 products and 26 variants. Functional pass, performance warning. |
| Supplier flow | PASS | Supplier created successfully, persisted after reload, and archived supplier is shown separately with restore action. |
| SKU mappings | WARNING | Mapping create/remove work, but native Variant/SKU dropdown looked production-unready. Replaced with searchable variant picker; needs retest after deploy. |
| Reorder planning | PENDING | Not tested yet. |
| Purchase orders | PASS | Created manual PO successfully. Totals calculate correctly and duplicate warnings function as expected. |
| Email review/send | PENDING | Not tested yet. |
| Receiving | PENDING | Not tested yet. |
| Stocky import | PENDING | Not tested yet. |
| Settings | PENDING | Not tested yet. |
| Vercel logs | PENDING | Monitor during each flow. |

## Detailed Test Log

### 1. Install and Auth

Status: `WARNING`

Steps tested:

- Opened Shopify admin app access screen.
- Installed/approved PODesk access.
- App redirected into embedded Shopify admin app.
- Dashboard loaded successfully.

Observed result:

- Dashboard page rendered correctly.
- App sidebar appeared.
- No raw `200` text page.
- No blank screen.
- No visible auth loop.

Expected result:

- Merchant lands on dashboard after install.
- App must remain embedded in Shopify admin.
- No crash or authorization error is shown.

### 2. Dashboard Sync

Status: `WARNING`

Steps tested:

- Clicked `Sync Shopify Inventory`.
- Loader appeared while sync was running.
- Sync completed after about 50-60 seconds.

Observed result:

```text
Basic MVP sync complete: synced 17 products, 26 variants, 2 locations. Orders scanned: 0.
```

Expected result:

- Loader should appear immediately.
- Sync should complete without page crash.
- Products, variants, locations, and sales velocity should update.
- Last sync status should update.

Result analysis:

- Functional behavior passed.
- Performance is slower than expected for 17 products and 26 variants.
- Likely causes are sequential Shopify API/database upsert work, Vercel cold start, or Shopify Admin API latency.

Recommended follow-up:

- Keep this as a performance warning for V1.
- Later optimization should batch or parallelize safe database writes, reduce sequential awaits, and add clearer progress copy for long-running sync.

## Remaining QA Checklist

### 3. Supplier Flow

Status: `PASS`

Test steps:

- Open `Suppliers`.
- Add a supplier with name, email, phone, lead time, minimum order, and payment terms.
- Reload page and confirm data persists.
- Edit supplier.
- Archive supplier.
- Restore supplier.
- Try saving without supplier name and confirm validation message.

Observed result:

- `QA Supplier` was created successfully.
- Supplier appears in `Active suppliers (1)`.
- Data persisted after page reload.
- Existing archived supplier appears in `Archived (1)` with a restore action.

Expected result:

- Supplier form is clear and responsive.
- Success and validation messages are readable.
- Supplier data persists correctly.
- Archived suppliers are separated from active suppliers and can be restored.

### 4. SKU Mapping

Status: `PASS`

Test steps:

- Open `SKU mappings`.
- Map one synced Shopify variant to an active supplier.
- Add supplier SKU, supplier cost, and lead time.
- Try creating duplicate mapping.
- Edit mapping.
- Delete mapping.

Observed result:

- Mapping created successfully.
- Remove action works.
- Supplier/variant relationship persists after reload.
- Duplicate mapping blocked with a clear validation message.
- No page crash or raw `200` response.
- Native `Variant / SKU` dropdown looked unprofessional because long product names were cramped/truncated.

Fix applied:

- Replaced native variant dropdown with a searchable variant picker.
- Picker supports product, variant, SKU, and Shopify variant ID search.
- Picker shows product and variant names on separate lines with mapped badge.
- Selected variant appears in a clean confirmation block.

Expected result:

- Mapping saves correctly.
- Duplicate mapping is blocked with a clear message.
- Data appears in reorder planning and PO creation.
- Picker looks professional and remains usable with many variants.

### 5. Reorder Planning

Status: `PENDING`

Test steps:

- Open `Reorder planning`.
- Confirm synced/mapped SKUs appear.
- Check suggested quantity, lead time, stock coverage, and risk status.
- Save manual reorder override.
- Clear override.
- Create purchase order from selected reorder row.

Expected result:

- Recommendations are understandable.
- Manual override affects final suggested quantity.
- PO creation redirects to the created PO detail page.

### 6. Purchase Orders

Status: `PASS`

Test steps:

- Open `Purchase orders`.
- Create a manual PO.
- Add line item.
- Remove line item.
- Edit PO reference and notes.
- Check duplicate warning when same SKU exists in another open PO.
- Open printable PO.

Observed result:
- PO created successfully with success banner.
- Table updated correctly with new PO details.

Expected result:

- PO totals calculate correctly.
- Duplicate warning is readable and does not crash.
- Print page renders a professional purchase order.

### 7. Email Review and Send

Status: `PENDING`

Test steps:

- Open `Settings`.
- Set supplier email automation to `Review before send`.
- Configure SMTP or Resend.
- Open PO detail.
- Review generated supplier email.
- Test open email draft.
- If configured, test app email send.
- Mark PO as sent.

Expected result:

- Merchant can review before sending.
- Secrets are not shown after saving settings.
- Email errors are clear if credentials are wrong.
- Successful send updates PO status and sent metadata.

### 8. Receiving

Status: `PENDING`

Test steps:

- Move PO to a receivable status.
- Receive partial quantity.
- Confirm remaining quantity updates.
- Receive full quantity.
- Try over-receiving.
- Check receiving history.

Expected result:

- Partial and full receiving work correctly.
- Over-receiving is blocked.
- PO status changes correctly.
- Receiving history is accurate.

### 9. Stocky Import

Status: `PENDING`

Test steps:

- Open `Stocky import`.
- Download sample CSV.
- Upload valid CSV.
- Upload invalid CSV.
- Review import preview and invalid row handling.
- Confirm imported supplier/mapping data is usable.

Expected result:

- CSV import flow handles success and errors professionally.
- Invalid data does not corrupt existing records.

### 10. Settings

Status: `PENDING`

Test steps:

- Save company name, currency, PO prefix, default terms, and default notes.
- Reload settings page.
- Confirm values persist.
- Save SMTP/Resend credentials.
- Reload and confirm secrets are not visible.
- Save again with blank secret fields and confirm existing secrets are preserved.

Expected result:

- Settings persist correctly.
- Sensitive credentials are never returned to the UI.
- Blank secret fields do not erase configured credentials.

### 11. Responsive and Slow Network

Status: `PENDING`

Test steps:

- Test dashboard, suppliers, mappings, reorder, PO detail, and settings at mobile width.
- Use Chrome network throttling.
- Confirm loader appears during slow requests.

Expected result:

- No overlapping text or controls.
- Forms remain usable on mobile.
- Slow operations show professional loading states.

### 12. Production Logs

Status: `PENDING`

Test steps:

- Keep Vercel live logs open during QA.
- Check logs after every major action.
- Open `/healthz`.

Expected result:

- No fatal errors.
- No repeated auth failures.
- No unhandled server exceptions.
- Health endpoint reports healthy app/database state.
