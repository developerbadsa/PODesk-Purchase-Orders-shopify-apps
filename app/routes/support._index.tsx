import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Merchant Help Center & FAQ | PODesk: Purchase Orders" },
    { name: "description", content: "Frequently asked questions and merchant support for PODesk: Purchase Orders." },
  ];
};

export default function SupportIndexPage() {
  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px" }}>Merchant Help Center &amp; FAQ</h1>
        <p style={{ margin: 0, color: "#616161", fontSize: "14px" }}>
          <strong>PODesk: Purchase Orders</strong> &bull; Merchant Support &amp; Knowledge Base
        </p>
        <nav style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
          <a href="/support" style={navBadgeActiveStyle}>FAQ</a>
          <a href="/support/getting-started" style={navBadgeStyle}>Getting Started Guide</a>
          <a href="/support/troubleshooting" style={navBadgeStyle}>Troubleshooting Guide</a>
        </nav>
      </header>

      <main style={contentStyle}>
        <section style={sectionStyle}>
          <h2>Frequently Asked Questions</h2>

          <div style={faqCardStyle}>
            <h3>Q1: Is PODesk free?</h3>
            <p><strong>Yes.</strong> PODesk is 100% free to install and use during our public launch beta. All current features—including inventory sync, supplier management, SKU mapping, reorder planning, purchase order receiving, and CSV import—are available without subscription fees or credit card requirements.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q2: Does PODesk change Shopify inventory?</h3>
            <p><strong>No.</strong> In the current release, PODesk operates on a strictly <strong>read-only</strong> basis regarding your Shopify store inventory. It syncs product details, inventory levels, and historical sales velocity to calculate reorder recommendations and manage purchase orders within PODesk. Receiving items or updating purchase orders within PODesk does <strong>not</strong> write stock counts back to your Shopify catalog, protecting your store from accidental inventory changes.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q3: What data is synced from my Shopify store?</h3>
            <p>PODesk syncs four main data categories:</p>
            <ul>
              <li><strong>Products &amp; Variants:</strong> Product titles, variant titles, SKUs, barcodes, product handles, and variant IDs.</li>
              <li><strong>Locations:</strong> Active inventory stocking locations configured in your Shopify admin.</li>
              <li><strong>Inventory Items:</strong> Aggregate stock quantities across your active locations.</li>
              <li><strong>Recent Orders:</strong> Order line items and sales timestamps over historical windows (7, 14, 30, and 90 days) to compute daily sales velocity.</li>
            </ul>
          </div>

          <div style={faqCardStyle}>
            <h3>Q4: What is a supplier mapping?</h3>
            <p>A supplier mapping connects a Shopify product variant SKU to a specific supplier record in PODesk. It allows you to specify supplier SKUs, wholesale cost prices, supplier lead times in days, and primary supplier status.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q5: How does reorder quantity work?</h3>
            <p>PODesk calculates suggested reorder quantities using historical sales velocity and supplier lead times:</p>
            <div style={{ background: "#f5f5f5", padding: "12px", borderRadius: "4px", fontFamily: "monospace", margin: "8px 0" }}>
              Suggested Reorder Qty = (Target Days &times; Daily Sales Velocity) &minus; Current Stock + Safety Buffer
            </div>
            <p>SKUs are categorized into risk levels: <strong>Critical</strong> (out of stock), <strong>Lead Time Risk</strong> (stock running out before lead time delivery), <strong>Low Stock</strong>, and <strong>Stock OK</strong>.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q6: Can I override the suggested reorder quantity?</h3>
            <p><strong>Yes.</strong> On the Reorder Planning page (<code>/app/reorder</code>), you can type a custom quantity directly into the <strong>Reorder Override</strong> field for any SKU. Your override is saved automatically per store and takes precedence over the formula calculation when generating draft purchase orders.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q7: Can I import Stocky data or spreadsheet CSV files?</h3>
            <p><strong>Yes.</strong> PODesk features a dedicated CSV Import tool (<code>/app/imports</code>). You can upload a <code>.csv</code> file or paste raw CSV text containing your suppliers and SKU mappings. PODesk auto-detects column headers, allows manual mapping overrides, validates rows before importing, and displays error reports for invalid rows.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q8: Can I receive purchase orders in PODesk?</h3>
            <p><strong>Yes.</strong> On any purchase order detail page, click <strong>Record receipt</strong> to enter received quantities line-by-line. PODesk supports both partial and full receipts, tracks line-level receiving progress, updates PO statuses automatically (<code>PARTIALLY_RECEIVED</code> or <code>RECEIVED</code>), and records timestamped receipt history logs.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q9: Can I email purchase orders to suppliers?</h3>
            <p><strong>Yes.</strong> PODesk includes a manual supplier email sharing workflow. From any PO detail page, click <strong>Share / Copy Email</strong> to generate a pre-formatted email message, copy text with one click, launch a native mailto draft, print clean PO copies, and click <strong>Mark as Sent</strong> to log communication timestamps.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q10: How do I uninstall PODesk or request data deletion?</h3>
            <p>You can uninstall PODesk at any time via <strong>Shopify Admin &gt; Settings &gt; Apps and sales channels &gt; Uninstall</strong>. All OAuth session tokens are revoked and store data is scheduled for complete deletion within 30 days per our <a href="/data-deletion" style={linkStyle}>Data Deletion Policy</a>. For immediate data removal, email support at <code>support@podesk.app</code>.</p>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2>Need Further Assistance?</h2>
          <p>Contact our merchant support team:</p>
          <p><strong>Support Email:</strong> <code>support@podesk.app</code></p>
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

const navBadgeStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "#f5f5f5",
  borderRadius: "4px",
  color: "#424242",
  textDecoration: "none",
  fontSize: "14px",
};

const navBadgeActiveStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "#1976d2",
  borderRadius: "4px",
  color: "#fff",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: 600,
};

const contentStyle: React.CSSProperties = {
  marginBottom: "40px",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: "32px",
};

const faqCardStyle: React.CSSProperties = {
  border: "1px solid #e0e0e0",
  borderRadius: "6px",
  padding: "16px",
  marginBottom: "16px",
  background: "#fafafa",
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
