import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Data Deletion Policy | PODesk: Purchase Orders" },
    { name: "description", content: "Data deletion and retention policy for PODesk: Purchase Orders." },
  ];
};

export default function DataDeletionPage() {
  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <img
          src="/brand/podesk-logo-horizontal.png"
          alt="PODesk"
          style={{ maxWidth: "200px", height: "auto", display: "block", marginBottom: "16px" }}
        />
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px" }}>Data Deletion &amp; Retention Policy</h1>
        <p style={{ margin: 0, color: "#616161", fontSize: "14px" }}>
          <strong>PODesk: Purchase Orders</strong> &bull; Effective Date: August 2, 2026
        </p>
      </header>

      <div style={disclaimerBoxStyle}>
        <strong>LEGAL DISCLAIMER:</strong> This Data Deletion Policy is an operational protocol written to fulfill Shopify App Store requirements and GDPR privacy compliance. It does not replace qualified legal review.
      </div>

      <main style={contentStyle}>
        <section style={sectionStyle}>
          <h2>1. Overview</h2>
          <p>
            This Data Deletion &amp; Retention Policy explains what happens to store data, supplier records, purchase orders, and session credentials when a merchant uninstalls <strong>PODesk: Purchase Orders</strong> or requests data removal.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>2. Uninstallation Handling (Automated Webhooks)</h2>
          <p>When a merchant uninstalls the App from their Shopify store:</p>
          <ol>
            <li>Shopify automatically issues an <code>app/uninstalled</code> or <code>shop/redact</code> HTTP webhook to our backend servers.</li>
            <li>The App immediately invalidates all stored OAuth session tokens (<code>Session</code> database model), preventing further API communication with the uninstalled store.</li>
            <li>The store record and associated operational data are queued for permanent deletion.</li>
          </ol>
        </section>

        <section style={sectionStyle}>
          <h2>3. Data Deletion Timeframe</h2>
          <ul>
            <li><strong>Standard Purge Window:</strong> All store data associated with an uninstalled store is permanently deleted from our active production database within <strong>30 days</strong> of the uninstallation date.</li>
            <li><strong>Immediate Deletion Requests:</strong> Merchants may request immediate deletion of their store data prior to the 30-day window by emailing support.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2>4. Categories of Data Deleted</h2>
          <p>Upon uninstallation or receipt of an explicit deletion request, the following database entities associated with your store are permanently purged:</p>

          <table style={tableStyle}>
            <thead>
              <tr style={{ background: "#f5f5f5" }}>
                <th style={thStyle}>Data Category</th>
                <th style={thStyle}>Specific Database Entities Purged</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdStyle}><strong>Auth &amp; Sessions</strong></td>
                <td style={tdStyle}>Store sessions, OAuth access tokens, scope permissions.</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Store Identity &amp; Settings</strong></td>
                <td style={tdStyle}>Store domain, business profile, PO reference prefix, currency settings, default lead times.</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Catalog Sync Data</strong></td>
                <td style={tdStyle}>Synced product records, variant records, inventory location mappings, recent order sales velocity records.</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Supplier Records</strong></td>
                <td style={tdStyle}>Supplier profiles, contact names, email addresses, phone numbers, lead times, payment terms, supplier notes.</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>SKU Mappings</strong></td>
                <td style={tdStyle}>SKU-to-supplier mappings, supplier SKUs, unit costs, lead time overrides, primary supplier flags.</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Purchase Orders &amp; Receipts</strong></td>
                <td style={tdStyle}>Purchase order headers, line items, PO statuses, notes, receipt logs, receiving line items.</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Reorder Overrides</strong></td>
                <td style={tdStyle}>Manual reorder quantity overrides set by merchant on the reorder planning table.</td>
              </tr>
              <tr>
                <td style={tdStyle}><strong>Import Jobs</strong></td>
                <td style={tdStyle}>History of CSV imports, uploaded file metadata, validation logs, error exports.</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section style={sectionStyle}>
          <h2>5. Backup Retention &amp; Snapshot Purging</h2>
          <ul>
            <li><strong>Database Snapshots:</strong> Automated, encrypted database backup snapshots are maintained for disaster recovery and operational continuity.</li>
            <li><strong>Backup Purge Cycle:</strong> Automated backup snapshots are rotated and permanently overwritten within <strong>14 to 30 days</strong>. Once overwritten, data cannot be recovered from backups.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2>6. How to Request Manual Data Deletion</h2>
          <p>Merchants who wish to confirm data deletion or request immediate data removal prior to the automated 30-day cycle may contact support:</p>
          <div style={{ background: "#f5f5f5", padding: "16px", borderRadius: "6px", fontSize: "14px" }}>
            <p style={{ margin: "0 0 8px 0" }}><strong>Send Email To:</strong> <code>support@podesk.app</code></p>
            <p style={{ margin: "0 0 8px 0" }}><strong>Subject Line:</strong> <code>PODesk Data Deletion Request - [Your Myshopify Domain]</code></p>
            <p style={{ margin: 0 }}><strong>Required Information:</strong> Provide your <code>.myshopify.com</code> store domain and confirmation that you are an authorized administrator of the store.</p>
          </div>
          <p style={{ fontSize: "13px", color: "#757575", marginTop: "4px" }}>
            *(Note: Replace support@podesk.app with your live active support mailbox before public launch).*
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

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
  marginTop: "12px",
};

const thStyle: React.CSSProperties = {
  padding: "10px",
  textAlign: "left",
  borderBottom: "2px solid #e0e0e0",
};

const tdStyle: React.CSSProperties = {
  padding: "10px",
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
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
