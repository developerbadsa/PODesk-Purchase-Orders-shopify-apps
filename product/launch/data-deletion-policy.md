# Data Deletion & Retention Policy for PODesk: Purchase Orders

**Effective Date**: [Insert Date, e.g., August 2, 2026]  
**Last Updated**: [Insert Date, e.g., August 2, 2026]  
**App Name**: PODesk: Purchase Orders  
**Operator**: [Your Business / Developer Name, e.g., PODesk Software] ("we", "us", or "our")  

> **LEGAL DISCLAIMER**: This Data Deletion Policy is a draft operational protocol written to fulfill Shopify App Store requirements and GDPR mandatory privacy compliance. It does not replace qualified legal review.

---

## 1. Overview

This Data Deletion & Retention Policy explains what happens to store data, supplier records, purchase orders, and session credentials when a merchant uninstalls **PODesk: Purchase Orders** or requests data removal.

---

## 2. Uninstallation Handling (`app/uninstalled` Webhook)

When a merchant uninstalls the App from their Shopify store:
1. Shopify automatically issues an `app/uninstalled` HTTP webhook to our backend servers.
2. The App immediately invalidates all stored OAuth session tokens (`Session` database model), preventing further API communication with the uninstalled store.
3. The store record is marked as uninstalled and queued for data purging.

---

## 3. Data Deletion Timeframe

- **Standard Purge Window**: All store data associated with an uninstalled store is permanently deleted from our active production database within **30 days** of the uninstallation date.
- **Immediate Deletion Requests**: Merchants may request immediate deletion of their store data prior to the 30-day window by emailing support.

---

## 4. Categories of Data Deleted

Upon expiration of the 30-day purge window or receipt of an explicit deletion request, the following database entities associated with the merchant store domain are permanently deleted:

| Data Category | Specific Database Entities Purged |
|---|---|
| **Auth & Sessions** | Store sessions, OAuth access tokens, scope permissions. |
| **Store Identity & Settings** | Store domain, business profile, PO reference prefix, currency settings, default lead times. |
| **Catalog Sync Data** | Synced product records, variant records, inventory location mappings, recent order sales velocity records. |
| **Supplier Records** | Supplier profiles, contact names, email addresses, phone numbers, lead times, payment terms, supplier notes. |
| **SKU Mappings** | SKU-to-supplier mappings, supplier SKUs, unit costs, lead time overrides, primary supplier flags. |
| **Purchase Orders & Receipts** | Purchase order headers, line items, PO statuses, notes, receipt logs, receiving line items. |
| **Reorder Overrides** | Manual reorder quantity overrides set by merchant on the reorder planning table. |
| **Import Jobs** | History of CSV imports, uploaded file metadata, validation logs, error exports. |

---

## 5. Backup Retention & Snapshot Purging

- **Database Snapshots**: Automated, encrypted database backup snapshots are maintained for disaster recovery and operational continuity.
- **Backup Purge Cycle**: Automated backup snapshots are rotated and permanently overwritten within **14 to 30 days**. Once overwritten, data cannot be recovered from backups.

---

## 6. How to Request Manual Data Deletion

Merchants who wish to confirm data deletion or request immediate data removal prior to the automated 30-day cycle may contact support:

1. **Email Subject**: `PODesk Data Deletion Request - [Your Myshopify Domain]`
2. **Send To**: `support@podesk.app` *(Note: Replace with active support mailbox before public launch)*
3. **Required Information**: Provide your `.myshopify.com` store domain and confirmation that you are an authorized administrator of the store.

Upon verification, our support team will manually execute the store data deletion script and issue an email confirmation within **3 business days**.

---

## 7. GDPR Mandatory Webhook Endpoints

Before production App Store submission, PODesk must implement Shopify's mandatory GDPR privacy webhooks:
- `customers/data_request`: PODesk processes store-level inventory data and does not store customer personal data. Handler should return an empty confirmation payload.
- `customers/redact`: Handler should acknowledge the request because PODesk does not retain customer PII.
- `shop/redact`: Handler should execute or queue full shop data purge in accordance with this policy.
