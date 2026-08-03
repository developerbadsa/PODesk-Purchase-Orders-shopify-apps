# Privacy Policy for PODesk: Purchase Orders

**Effective Date**: [Insert Date, e.g., August 2, 2026]  
**Last Updated**: [Insert Date, e.g., August 2, 2026]  
**App Name**: PODesk: Purchase Orders  
**Operator / Company Name**: [Your Business / Developer Name, e.g., PODesk Software] ("we", "us", or "our")  

> **LEGAL DISCLAIMER**: This privacy policy is a draft document provided for operational and Shopify App Store readiness purposes. It does not constitute formal legal advice. Merchants and app operators should consult qualified legal counsel to ensure compliance with applicable regional privacy laws (including GDPR, CCPA, and PIPEDA).

---

## 1. Introduction

PODesk: Purchase Orders ("the App") is a Shopify embedded application designed to assist merchants with inventory reorder planning, supplier management, purchase order generation, and CSV imports. 

This Privacy Policy describes how personal and store data is collected, used, stored, and processed when you install or use the App in connection with your Shopify store.

---

## 2. Information We Access and Collect

When you install and use the App, we automatically access certain data from your Shopify store via authorized Shopify APIs, and collect information directly entered into the App by your authorized users.

### A. Data Synchronized from Shopify (Read-Only)
To perform inventory calculations, supplier mappings, and reorder recommendations, the App accesses:
- **Products & Variants**: Product titles, variant titles, SKUs, barcodes, variant IDs, product handles, and product vendor attributes.
- **Inventory Items & Locations**: Inventory item IDs, active location IDs, and aggregate inventory levels across your store.
- **Recent Orders & Sales Velocity**: Historical order line items, order dates, and quantities sold over configurable time windows (7, 14, 30, 90 days) to compute daily sales velocity.

### B. Data Entered by the Merchant
The App stores operational data created directly by you within the application:
- **Supplier Information**: Supplier company name, primary contact name, email address, phone number, physical address, default lead time, payment terms, and notes.
- **SKU-to-Supplier Mappings**: Custom supplier SKUs, supplier unit costs, lead time overrides, and primary supplier designation per SKU.
- **Purchase Orders & Line Items**: Auto-generated PO references, target arrival dates, unit costs, line item quantities, status logs, notes, and PO receiving records.
- **CSV Uploads & Imports**: Uploaded spreadsheet files, raw CSV text content, column header mappings, and row-level import validation logs.
- **App Settings & Preferences**: Company legal name, billing address, preferred currency symbol, PO reference prefix, and default lead time settings.

### C. Session & Authentication Data
- **OAuth Session Tokens**: Access tokens, store myshopify domain, and session identifiers managed via standard Shopify authentication protocols.

---

## 3. How We Use Your Data

We use the data collected strictly to provide, maintain, and improve the services offered by the App:
- To display your product catalog and calculate reorder recommendations based on historical sales velocity and inventory levels.
- To create, update, print, and track purchase orders and receiving logs.
- To execute CSV import jobs for supplier mapping and inventory data migration.
- To communicate with you regarding support inquiries, product updates, or technical alerts.

---

## 4. No Sale of Personal or Store Data

**We do not sell, rent, trade, or monetize your store data, customer data, or supplier details to third parties under any circumstances.** Data is never shared with third-party advertisers or data brokers.

---

## 5. Read-Only Shopify Inventory (Current Beta)

During the current beta release, the App operates on a strictly **read-only** basis regarding your Shopify store inventory and products. PODesk does **not** push inventory adjustments or write data back to your Shopify store catalog. All reorder calculations and purchase orders remain internal to PODesk.

---

## 6. Third-Party Service Providers

We may engage trusted third-party infrastructure providers to host our software and database infrastructure (e.g., cloud hosting providers such as Render/Fly.io/AWS, managed database services, and error logging tools). These service providers process data solely on our behalf and subject to strict confidentiality obligations.

---

## 7. Data Retention and Deletion

- **Retention During Active Install**: We retain your store data and operational records as long as the App remains installed on your Shopify store.
- **Post-Uninstallation Deletion**: When you uninstall the App, an automated `app/uninstalled` webhook notifies our servers. All associated store session tokens, supplier records, mappings, purchase orders, and settings are scheduled for permanent deletion within **30 days** of uninstallation.
- **Manual Deletion Requests**: You may request immediate deletion of your store data at any time by contacting us at our support email.

---

## 8. GDPR & Privacy Rights

If your store operates within the European Economic Area (EEA), United Kingdom, or other jurisdictions with data protection laws (such as CCPA in California):
- You have the right to request access to, correction of, or deletion of the data we process for your store.
- Because PODesk processes store-level operational inventory data and does **not** collect end-customer personal data (PII), GDPR customer data requests (`customers/data_request` and `customers/redact`) yield no end-customer personal records.

---

## 9. Contact Information

If you have questions regarding this Privacy Policy or wish to exercise your data rights, please contact us at:

**Support Email**: `podeskapp@gmail.com`
**App Operator**: `[Your Company Name / Operator Placeholder]`  
**Address**: `[Your Physical Business Address Placeholder]`
