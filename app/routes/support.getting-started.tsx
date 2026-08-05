import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Getting Started Guide | PODesk: Purchase Orders" },
    { name: "description", content: "7-step merchant onboarding guide for PODesk: Purchase Orders." },
  ];
};

export default function GettingStartedPage() {
  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <img
          src="/brand/podesk-logo-horizontal.png"
          alt="PODesk"
          style={{ maxWidth: "200px", height: "auto", display: "block", marginBottom: "16px" }}
        />
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px" }}>Getting Started with PODesk</h1>
        <p style={{ margin: 0, color: "#616161", fontSize: "14px" }}>
          <strong>PODesk: Purchase Orders</strong> &bull; Merchant Onboarding Guide
        </p>
        <nav style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
          <a href="/support" style={navBadgeStyle}>FAQ</a>
          <a href="/support/getting-started" style={navBadgeActiveStyle}>Getting Started Guide</a>
          <a href="/support/troubleshooting" style={navBadgeStyle}>Troubleshooting Guide</a>
        </nav>
      </header>

      <main style={contentStyle}>
        <section style={sectionStyle}>
          <p style={{ fontSize: "16px" }}>
            Welcome! If you&apos;re looking to get your purchasing and inventory reordering set up quickly inside Shopify, you&apos;re in the right place. Here is a simple, 7-step walkthrough to take you from installing PODesk to sending your first purchase order and logging receipts.
          </p>

          <div style={stepCardStyle}>
            <h3>Step 1: Sync your Shopify products &amp; sales data</h3>
            <p>1. Open <strong>PODesk</strong> inside your Shopify Admin.</p>
            <p>2. Head to the <strong>Dashboard</strong> (<code>/app</code>) and click <strong>Sync Shopify inventory</strong> at the top.</p>
            <p>3. PODesk will grab your products, active stocking locations, current counts, and recent sales.</p>
            <p>4. When it finishes, you&apos;ll see your total synced counts right on the dashboard.</p>
          </div>

          <div style={stepCardStyle}>
            <h3>Step 2: Add your suppliers</h3>
            <p>1. Click <strong>Suppliers</strong> (<code>/app/suppliers</code>) in the left navigation menu.</p>
            <p>2. Click <strong>Add Supplier</strong> in the top header.</p>
            <p>3. Fill out the vendor details: Supplier Name, Contact Name &amp; Email, Phone &amp; Address, Default Lead Time, and Payment Terms.</p>
            <p>4. Hit <strong>Save Supplier</strong>.</p>
          </div>

          <div style={stepCardStyle}>
            <h3>Step 3: Map your SKUs to suppliers</h3>
            <p>1. Head over to <strong>SKU Mappings</strong> (<code>/app/mappings</code>).</p>
            <p>2. Click <strong>Add Mapping</strong> (or filter down to unmapped variants).</p>
            <p>3. Select your <strong>Shopify Variant</strong> and choose the matching <strong>Supplier</strong>.</p>
            <p>4. Fill in Supplier SKU, Unit Cost Price, Lead Time Override, and Primary Supplier status.</p>
            <p>5. Click <strong>Save Mapping</strong>.</p>
          </div>

          <div style={stepCardStyle}>
            <h3>Step 4: Check reorder suggestions &amp; tweak overrides</h3>
            <p>1. Click <strong>Reorder Planning</strong> (<code>/app/reorder</code>).</p>
            <p>2. Choose your <strong>Sales Window</strong> (7, 14, 30, or 90 days) and set your <strong>Buffer Days</strong>.</p>
            <p>3. Look for items marked <strong>Critical</strong> (out of stock) or <strong>Lead Time Risk</strong>.</p>
            <p>4. Type your custom quantity into the <strong>Reorder Override</strong> box if demand will spike or MOQs apply.</p>
            <p>5. Select checkboxes next to items for a single supplier, then click <strong>Create Draft PO</strong>.</p>
          </div>

          <div style={stepCardStyle}>
            <h3>Step 5: Review, print &amp; send your purchase order</h3>
            <p>1. PODesk creates a draft PO and opens the <strong>PO Detail Page</strong> (<code>/app/purchase-orders/:id</code>).</p>
            <p>2. Double-check your line items, costs, and expected arrival date.</p>
            <p>3. Click <strong>Share / Copy Email</strong> to get a formatted email draft ready for your supplier.</p>
            <p>4. Click <strong>Print PO</strong> if you want a clean printable sheet or PDF export.</p>
            <p>5. Click <strong>Mark as Sent</strong> when you&apos;ve placed the order with your vendor.</p>
          </div>

          <div style={stepCardStyle}>
            <h3>Step 6: Log item receipts when shipments arrive</h3>
            <p>1. When your delivery arrives, open the PO in PODesk.</p>
            <p>2. Click <strong>Record receipt</strong>.</p>
            <p>3. Type in how many units arrived for each line item (supports partial receiving if shipments come in parts).</p>
            <p>4. Click <strong>Save Receipt</strong>. PODesk updates your receiving progress bar, updates PO status, and records a receipt log.</p>
          </div>

          <div style={stepCardStyle}>
            <h3>Step 7: Importing data from Stocky or Excel</h3>
            <p>1. Click <strong>Stocky Import</strong> (<code>/app/imports</code>).</p>
            <p>2. Grab our sample template by clicking <strong>Download sample CSV</strong>.</p>
            <p>3. Upload your <code>.csv</code> file or paste in raw text.</p>
            <p>4. Check auto-matched columns and click <strong>Preview Validation</strong>.</p>
            <p>5. Click <strong>Import Valid Rows</strong> to import your suppliers and mappings instantly.</p>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2>Need Further Assistance?</h2>
          <p>Contact our merchant support team:</p>
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

const stepCardStyle: React.CSSProperties = {
  borderLeft: "4px solid #1976d2",
  background: "#fafafa",
  borderRadius: "0 6px 6px 0",
  padding: "16px",
  marginBottom: "16px",
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


