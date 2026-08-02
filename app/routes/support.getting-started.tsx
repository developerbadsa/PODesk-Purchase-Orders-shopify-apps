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
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px" }}>Getting Started Guide</h1>
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
            Welcome to <strong>PODesk: Purchase Orders</strong>! Follow this 7-step guide to move from initial app installation to issuing and receiving your first purchase order in 10 minutes.
          </p>

          <div style={stepCardStyle}>
            <h3>Step 1: Sync Your Shopify Inventory &amp; Sales Velocity</h3>
            <p>1. Open <strong>PODesk</strong> inside your Shopify Admin frame.</p>
            <p>2. On the <strong>Operations Dashboard</strong> (<code>/app</code>), click the <strong>Sync Shopify inventory</strong> button in the top banner.</p>
            <p>3. PODesk will pull your Shopify products, variants, active locations, and recent sales velocity.</p>
            <p>4. Once completed, review your synced catalog counts (e.g., <em>26 variants synced across 2 locations</em>).</p>
          </div>

          <div style={stepCardStyle}>
            <h3>Step 2: Add Your Suppliers</h3>
            <p>1. Navigate to <strong>Suppliers</strong> (<code>/app/suppliers</code>) from the app navigation menu.</p>
            <p>2. Click <strong>Add Supplier</strong> in the top header.</p>
            <p>3. Enter your supplier&apos;s profile details: Supplier Name, Primary Contact, Email, Phone, Default Lead Time (Days), and Payment Terms.</p>
            <p>4. Click <strong>Save Supplier</strong>.</p>
          </div>

          <div style={stepCardStyle}>
            <h3>Step 3: Map SKUs to Suppliers</h3>
            <p>1. Navigate to <strong>SKU Mappings</strong> (<code>/app/mappings</code>).</p>
            <p>2. Click <strong>Add Mapping</strong> (or filter by unmapped variants).</p>
            <p>3. Select the <strong>Shopify Variant</strong> and choose the <strong>Supplier</strong>.</p>
            <p>4. Enter Supplier SKU, Unit Cost Price, Lead Time Override, and Primary Supplier status.</p>
            <p>5. Click <strong>Save Mapping</strong>.</p>
          </div>

          <div style={stepCardStyle}>
            <h3>Step 4: Use Reorder Planning &amp; Set Overrides</h3>
            <p>1. Navigate to <strong>Reorder Planning</strong> (<code>/app/reorder</code>).</p>
            <p>2. Select your desired <strong>Sales Window</strong> (7, 14, 30, or 90 days) and <strong>Buffer Days</strong>.</p>
            <p>3. Review SKUs flagged as <strong>Critical</strong> (out of stock) or <strong>Lead Time Risk</strong>.</p>
            <p>4. <em>(Optional)</em> Type a custom number in the <strong>Reorder Override</strong> field for any SKU if demand will spike or MOQs apply.</p>
            <p>5. Select checkboxes next to SKUs for a single supplier and click <strong>Create Draft PO</strong>.</p>
          </div>

          <div style={stepCardStyle}>
            <h3>Step 5: Format, Print &amp; Share Purchase Orders</h3>
            <p>1. PODesk automatically generates a multi-line draft purchase order and opens the PO Detail Page (<code>/app/purchase-orders/:id</code>).</p>
            <p>2. Review line items, quantities, unit costs, and subtotal.</p>
            <p>3. Click <strong>Share / Copy Email</strong> to generate a pre-formatted email draft for your supplier.</p>
            <p>4. Click <strong>Print PO</strong> to generate a clean printable PO document.</p>
            <p>5. Click <strong>Mark as Sent</strong> to update the PO status to <code>SENT</code>.</p>
          </div>

          <div style={stepCardStyle}>
            <h3>Step 6: Receive Purchase Orders &amp; Track Inventory</h3>
            <p>1. When shipment arrives from your supplier, open the purchase order in PODesk.</p>
            <p>2. Click <strong>Record receipt</strong>.</p>
            <p>3. Enter received quantities for line items (supports partial receiving if items arrive in multiple shipments).</p>
            <p>4. Click <strong>Save Receipt</strong>. PODesk updates receiving progress bars, transitions status to <code>PARTIALLY_RECEIVED</code> or <code>RECEIVED</code>, and logs receipt history.</p>
          </div>

          <div style={stepCardStyle}>
            <h3>Step 7: Import Data via CSV (Stocky Migration)</h3>
            <p>1. Navigate to <strong>Stocky Import</strong> (<code>/app/imports</code>).</p>
            <p>2. Click <strong>Download sample CSV</strong> to review the expected layout.</p>
            <p>3. Upload your <code>.csv</code> file or paste raw CSV text.</p>
            <p>4. Review auto-detected column headers and click <strong>Preview Validation</strong>.</p>
            <p>5. Click <strong>Import Valid Rows</strong> to complete your supplier and SKU mapping migration in seconds.</p>
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
