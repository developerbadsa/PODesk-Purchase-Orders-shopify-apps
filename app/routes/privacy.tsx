import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Privacy Policy | PODesk: Purchase Orders" },
    { name: "description", content: "Privacy policy for PODesk: Purchase Orders Shopify app." },
  ];
};

export default function PrivacyPage() {
  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <img
          src="/brand/podesk-logo-horizontal.png"
          alt="PODesk"
          style={{ maxWidth: "200px", height: "auto", display: "block", marginBottom: "16px" }}
        />
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px" }}>Privacy Policy</h1>
        <p style={{ margin: 0, color: "#616161", fontSize: "14px" }}>
          <strong>PODesk: Purchase Orders</strong> &bull; Effective Date: August 2, 2026
        </p>
      </header>

      <div style={disclaimerBoxStyle}>
        <strong>LEGAL DISCLAIMER:</strong> This Privacy Policy is a draft document provided for operational and Shopify App Store readiness purposes. It does not constitute formal legal advice. Merchants and app operators should consult qualified legal counsel to ensure compliance with applicable regional privacy laws (including GDPR, CCPA, and PIPEDA).
      </div>

      <main style={contentStyle}>
        <section style={sectionStyle}>
          <h2>1. Introduction</h2>
          <p>
            PODesk: Purchase Orders (&quot;the App&quot;) is a Shopify embedded application designed to assist merchants with inventory reorder planning, supplier management, purchase order generation, and CSV imports. This Privacy Policy describes how personal and store data is collected, used, stored, and processed when you install or use the App in connection with your Shopify store.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>2. Information We Access and Collect</h2>
          <h3>A. Data Synchronized from Shopify (Read-Only)</h3>
          <p>To perform inventory calculations, supplier mappings, and reorder recommendations, the App accesses:</p>
          <ul>
            <li><strong>Products &amp; Variants:</strong> Product titles, variant titles, SKUs, barcodes, variant IDs, product handles, and product vendor attributes.</li>
            <li><strong>Inventory Items &amp; Locations:</strong> Inventory item IDs, active location IDs, and aggregate inventory levels across your store.</li>
            <li><strong>Recent Orders &amp; Sales Velocity:</strong> Historical order line items, order dates, and quantities sold over configurable time windows (7, 14, 30, 90 days) to compute daily sales velocity.</li>
          </ul>

          <h3>B. Data Entered by the Merchant</h3>
          <p>The App stores operational data created directly by you within the application:</p>
          <ul>
            <li><strong>Supplier Information:</strong> Supplier company name, primary contact name, email address, phone number, physical address, default lead time, payment terms, and notes.</li>
            <li><strong>SKU-to-Supplier Mappings:</strong> Custom supplier SKUs, supplier unit costs, lead time overrides, and primary supplier designation per SKU.</li>
            <li><strong>Purchase Orders &amp; Line Items:</strong> Auto-generated PO references, target arrival dates, unit costs, line item quantities, status logs, notes, and PO receiving records.</li>
            <li><strong>CSV Uploads &amp; Imports:</strong> Uploaded spreadsheet files, raw CSV text content, column header mappings, and row-level import validation logs.</li>
            <li><strong>App Settings &amp; Preferences:</strong> Company legal name, billing address, preferred currency symbol, PO reference prefix, and default lead time settings.</li>
          </ul>

          <h3>C. Session &amp; Authentication Data</h3>
          <ul>
            <li><strong>OAuth Session Tokens:</strong> Access tokens, store myshopify domain, and session identifiers managed via standard Shopify authentication protocols.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2>3. How We Use Your Data</h2>
          <p>We use the data collected strictly to provide, maintain, and improve the services offered by the App:</p>
          <ul>
            <li>To display your product catalog and calculate reorder recommendations based on historical sales velocity and inventory levels.</li>
            <li>To create, update, print, and track purchase orders and receiving logs.</li>
            <li>To execute CSV import jobs for supplier mapping and inventory data migration.</li>
            <li>To communicate with you regarding support inquiries, product updates, or technical alerts.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2>4. No Sale of Personal or Store Data</h2>
          <p>
            <strong>We do not sell, rent, trade, or monetize your store data, customer data, or supplier details to third parties under any circumstances.</strong> Data is never shared with third-party advertisers or data brokers.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>5. Read-Only Shopify Inventory (Current Beta)</h2>
          <p>
            During the current beta release, the App operates on a strictly <strong>read-only</strong> basis regarding your Shopify store inventory and products. PODesk does <strong>not</strong> push inventory adjustments or write data back to your Shopify store catalog. All reorder calculations and purchase orders remain internal to PODesk.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>6. Data Retention and Deletion</h2>
          <ul>
            <li><strong>Retention During Active Install:</strong> We retain your store data and operational records as long as the App remains installed on your Shopify store.</li>
            <li><strong>Post-Uninstallation Deletion:</strong> When you uninstall the App, an automated <code>app/uninstalled</code> or <code>shop/redact</code> webhook notifies our servers. All associated store session tokens, supplier records, mappings, purchase orders, and settings are scheduled for permanent deletion within <strong>30 days</strong> of uninstallation.</li>
            <li><strong>Manual Deletion Requests:</strong> You may request immediate deletion of your store data at any time by contacting support.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2>7. GDPR &amp; Privacy Rights</h2>
          <p>
            If your store operates within the European Economic Area (EEA), United Kingdom, or other jurisdictions with data protection laws (such as CCPA in California), you have the right to request access to or deletion of data we process for your store. Because PODesk processes store-level operational inventory data and does <strong>not</strong> collect end-customer personal data (PII), GDPR customer data requests (<code>customers/data_request</code> and <code>customers/redact</code>) yield no end-customer personal records.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>8. Contact Information</h2>
          <p>For inquiries regarding this Privacy Policy or data requests:</p>
          <p><strong>Support Email:</strong> <code>podeskapp@gmail.com</code></p>
          <p style={{ fontSize: "13px", color: "#757575", marginTop: "4px" }}>
            *(Note: Current live support mailbox for PODesk).*
          </p>
        </section>
      </main>

      <footer style={footerStyle}>
        <p>&copy; 2026 PODesk: Purchase Orders. All rights reserved.</p>
        <div style={{ marginTop: "8px", display: "flex", gap: "16px", justifyContent: "center" }}>
          <a href="/privacy" style={linkStyle}>Privacy Policy</a>
          <a href="/terms" style={linkStyle}>Terms of Service</a>
          <a href="/data-deletion" style={linkStyle}>Data Deletion</a>
          <a href="/support" style={linkStyle}>Help Center</a>
        </div>
      </footer>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: "800px",
  margin: "0 auto",
  padding: "40px 20px",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  color: "#212121",
  lineHeight: 1.6,
};

const headerStyle: React.CSSProperties = {
  borderBottom: "1px solid #e0e0e0",
  paddingBottom: "16px",
  marginBottom: "24px",
};

const disclaimerBoxStyle: React.CSSProperties = {
  background: "#fff8e1",
  border: "1px solid #ffe082",
  borderRadius: "6px",
  padding: "12px 16px",
  fontSize: "14px",
  color: "#795548",
  marginBottom: "24px",
};

const contentStyle: React.CSSProperties = {
  marginBottom: "40px",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: "24px",
};

const footerStyle: React.CSSProperties = {
  borderTop: "1px solid #e0e0e0",
  paddingTop: "20px",
  textAlign: "center",
  fontSize: "14px",
  color: "#757575",
};

const linkStyle: React.CSSProperties = {
  color: "#1976d2",
  textDecoration: "none",
};


