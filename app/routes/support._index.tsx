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
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px" }}>PODesk FAQ &amp; Help Guide</h1>
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
            <h3>Q1: Is PODesk actually free?</h3>
            <p><strong>Yes, completely.</strong> During our public beta, every single feature in PODesk is free. That includes catalog sync, supplier management, SKU mapping, reorder math, PO receiving, and CSV imports. We don&apos;t ask for a credit card, and there are no hidden limits during the beta.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q2: Will PODesk change or mess up my Shopify stock levels?</h3>
            <p><strong>No, never.</strong> PODesk works on a strictly <strong>read-only</strong> connection to your Shopify inventory. We read your products, current stock counts, and recent sales to calculate reorders and help you build purchase orders inside PODesk. When you receive items or update a purchase order in PODesk, we do <strong>not</strong> write those stock numbers back into Shopify automatically.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q3: What store data does PODesk pull from Shopify?</h3>
            <p>We only pull what is necessary to handle inventory planning:</p>
            <ul>
              <li><strong>Products &amp; Variants:</strong> Product titles, SKU codes, barcodes, variant names, handles, and supplier vendor names.</li>
              <li><strong>Locations:</strong> Active stocking locations configured in your Shopify Admin.</li>
              <li><strong>Inventory Items:</strong> Aggregate stock quantities across your locations.</li>
              <li><strong>Recent Orders:</strong> Order line items and sale dates over historical windows (7, 14, 30, or 90 days) so we can figure out your daily sales velocity.</li>
            </ul>
          </div>

          <div style={faqCardStyle}>
            <h3>Q4: What is a supplier mapping?</h3>
            <p>Think of mapping as linking a Shopify product to the exact vendor you buy it from. In PODesk, a mapping connects your variant SKU to a supplier along with supplier SKUs, wholesale unit costs, supplier lead times, and primary supplier flags.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q5: How does PODesk figure out reorder recommendations?</h3>
            <p>We use a clean, transparent formula based on how fast you sell items and how long suppliers take to deliver:</p>
            <div style={{ background: "#f5f5f5", padding: "12px", borderRadius: "4px", fontFamily: "monospace", margin: "8px 0" }}>
              Suggested Reorder Qty = (Target Days of Stock &times; Daily Sales Velocity) &minus; Current Stock + Safety Buffer
            </div>
            <p>Items are flagged with clear status tags: <strong>Critical</strong> (already out of stock), <strong>Lead Time Risk</strong> (stock will run out before a new shipment arrives), <strong>Low Stock</strong>, or <strong>Stock OK</strong>.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q6: Can I change or override the recommended reorder amount?</h3>
            <p><strong>Yes.</strong> On the Reorder page (<code>/app/reorder</code>), you can type your own number into the <strong>Reorder Override</strong> box for any item. Your override is saved automatically and used whenever you generate a draft PO.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q7: Can I bring over data from Stocky or my own spreadsheets?</h3>
            <p><strong>Yes.</strong> We built a CSV Import tool (<code>/app/imports</code>) specifically for merchants moving off Stocky or Excel. You can upload a <code>.csv</code> file or paste raw text. PODesk auto-matches your column headers, lets you tweak the mapping, previews the data before importing, and gives you an error report if rows need fixing.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q8: Can I track item receiving on purchase orders?</h3>
            <p><strong>Yes.</strong> Open any purchase order (<code>/app/purchase-orders/:id</code>) and click <strong>Record receipt</strong>. You can enter incoming item counts line-by-line. If shipment arrives in parts, PODesk tracks partial receipts, updates the PO status (<code>PARTIALLY_RECEIVED</code> or <code>RECEIVED</code>), and keeps a timestamped receipt log.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q9: Can I email purchase orders straight to suppliers?</h3>
            <p><strong>Yes.</strong> On any PO page, click <strong>Share / Copy Email</strong>. PODesk formats a pre-filled email draft with supplier contact details, PO reference, line items, and totals. You can copy text with one click, launch your default email app, print clean copies, and click <strong>Mark as Sent</strong>.</p>
          </div>

          <div style={faqCardStyle}>
            <h3>Q10: How do I uninstall or get my data removed?</h3>
            <p>Uninstalling is standard: go to <strong>Shopify Admin &gt; Settings &gt; Apps and sales channels &gt; Uninstall</strong>. Once uninstalled, all session tokens are revoked and store data is scheduled for complete deletion within 30 days per our <a href="/data-deletion" style={linkStyle}>Data Deletion Policy</a>. For immediate data removal, drop us a line at <code>support@podesk.app</code>.</p>
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
