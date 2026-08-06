# PODesk V1 QA Test Session

Date: August 6, 2026  
Store: `test-store-fgyympec.myshopify.com`  
Environment: Shopify embedded app on Vercel production  
Tester: Rahim Badsa  
Status: In progress

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
