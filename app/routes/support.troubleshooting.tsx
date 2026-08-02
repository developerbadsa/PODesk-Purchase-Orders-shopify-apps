import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Troubleshooting Guide | PODesk: Purchase Orders" },
    { name: "description", content: "Technical troubleshooting and issue resolution for PODesk: Purchase Orders." },
  ];
};

export default function TroubleshootingPage() {
  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px" }}>Troubleshooting &amp; Error Resolution</h1>
        <p style={{ margin: 0, color: "#616161", fontSize: "14px" }}>
          <strong>PODesk: Purchase Orders</strong> &bull; Technical Troubleshooting Guide
        </p>
        <nav style={{ marginTop: "16px", display: "flex", gap: "12px" }}>
          <a href="/support" style={navBadgeStyle}>FAQ</a>
          <a href="/support/getting-started" style={navBadgeStyle}>Getting Started Guide</a>
          <a href="/support/troubleshooting" style={navBadgeActiveStyle}>Troubleshooting Guide</a>
        </nav>
      </header>

      <main style={contentStyle}>
        <section style={sectionStyle}>
          <p style={{ fontSize: "16px" }}>
            This guide provides step-by-step resolution steps for common issues encountered during development, installation, inventory sync, purchase orders, and CSV data imports.
          </p>

          <div style={issueCardStyle}>
            <h3>1. App Shows Blank Page or Loading Spinner Indefinitely</h3>
            <p><strong>Symptoms:</strong> Opening PODesk inside Shopify Admin displays a blank white screen or continuous loading spinner.</p>
            <p><strong>Root Cause:</strong> Browser session token has expired or cross-site tracking protections block iframe cookies.</p>
            <p><strong>Resolution:</strong></p>
            <ol>
              <li>Hard refresh your browser frame (<code>Ctrl + Shift + R</code> or <code>Cmd + Shift + R</code>).</li>
              <li>Ensure third-party cookies or cross-site tracking protections are allowed for Shopify Admin (<code>admin.shopify.com</code>).</li>
              <li>Try opening Shopify Admin in an Incognito/Private window.</li>
            </ol>
          </div>

          <div style={issueCardStyle}>
            <h3>2. &quot;Access Denied&quot; Scope Errors During Inventory Sync</h3>
            <p><strong>Symptoms:</strong> Sync fails with error notification such as <em>&quot;Access denied for products field&quot;</em> or <em>&quot;Access denied for locations field&quot;</em>.</p>
            <p><strong>Root Cause:</strong> Store holds an outdated access token generated before required scopes (<code>read_products,read_inventory,read_locations,read_orders</code>) were set in <code>shopify.app.toml</code>.</p>
            <p><strong>Resolution:</strong></p>
            <ol>
              <li>Open Shopify Admin, go to <strong>Settings &gt; Apps and sales channels</strong>.</li>
              <li>Locate <strong>PODesk: Purchase Orders</strong> and click <strong>Uninstall</strong>.</li>
              <li>If running CLI development, stop server (<code>q</code>), then restart with reset: <code>npm run dev -- --reset</code>.</li>
              <li>Re-install PODesk on your development store and accept the updated permission prompts.</li>
              <li>Re-open PODesk and click <strong>Sync Shopify inventory</strong> again.</li>
            </ol>
          </div>

          <div style={issueCardStyle}>
            <h3>3. Inventory Sync Query Fails or Cost Exceeded</h3>
            <p><strong>Symptoms:</strong> Sync fails with GraphQL query cost limit errors or timeout messages.</p>
            <p><strong>Root Cause:</strong> Catalog or order volume exceeds single-query cost limits.</p>
            <p><strong>Resolution:</strong> PODesk limits products to 1,000 items (40 pages &times; 25 items) and orders to 1,000 items (10 pages &times; 25 items) per single sync action. If your catalog exceeds 5,000 SKUs, wait 60 seconds for Shopify GraphQL rate limits to replenish, then re-trigger sync.</p>
          </div>

          <div style={issueCardStyle}>
            <h3>4. No Products Displayed After Sync</h3>
            <p><strong>Symptoms:</strong> Sync reports success, but products or variants do not appear in SKU Mappings or Reorder table.</p>
            <p><strong>Resolution:</strong> Verify that your products in Shopify Admin have <strong>SKUs</strong> defined. PODesk filters and maps variants using Shopify SKUs. Ensure products are set to <strong>Active</strong> status and variants have <strong>Track quantity</strong> enabled.</p>
          </div>

          <div style={issueCardStyle}>
            <h3>5. Reorder Table Shows No Suggestions or &quot;Map Supplier First&quot;</h3>
            <p><strong>Symptoms:</strong> Reorder Planning table shows SKUs with zero suggested quantity or <em>&quot;Map supplier first&quot;</em> status reason.</p>
            <p><strong>Resolution:</strong></p>
            <ol>
              <li><strong>Assign Supplier Mapping:</strong> Go to <code>/app/mappings</code> and map the SKU to a supplier.</li>
              <li><strong>Sales Velocity Check:</strong> If a product had zero sales in the selected window (e.g., past 30 days), daily sales velocity is zero. Select a broader sales window (e.g., 90 days).</li>
              <li><strong>Manual Override:</strong> Enter a custom number in the <strong>Reorder Override</strong> field on <code>/app/reorder</code>.</li>
            </ol>
          </div>

          <div style={issueCardStyle}>
            <h3>6. CSV Import Reports Invalid Rows</h3>
            <p><strong>Symptoms:</strong> Uploading or pasting a CSV file on <code>/app/imports</code> results in skipped rows or invalid row warnings.</p>
            <p><strong>Resolution:</strong> Ensure column headers match expected names or use column override dropdowns. Required columns: <code>handle</code> or <code>sku</code>, and <code>supplier_name</code>. Click <strong>Export Invalid Rows</strong> to download a CSV containing failed rows and specific error reasons.</p>
          </div>

          <div style={issueCardStyle}>
            <h3>7. Purchase Order Cannot Be Received</h3>
            <p><strong>Symptoms:</strong> Clicking <strong>Record receipt</strong> or saving line item receipts on a PO page yields an error.</p>
            <p><strong>Resolution:</strong> Verify PO status is <code>SENT</code>, <code>CONFIRMED</code>, or <code>PARTIALLY_RECEIVED</code>. POs in <code>DRAFT</code> status must be marked as sent before receiving items. Received quantity inputs cannot be negative or exceed remaining balance.</p>
          </div>

          <div style={issueCardStyle}>
            <h3>8. Mixed Supplier Selection Blocked During PO Creation</h3>
            <p><strong>Symptoms:</strong> When selecting multiple rows on Reorder table, <strong>Create Draft PO</strong> button is disabled or displays a validation warning.</p>
            <p><strong>Resolution:</strong> Multi-row draft PO creation requires <strong>all selected SKUs to belong to the same supplier</strong>. Filter the Reorder table by a single supplier using the Supplier Filter dropdown before selecting rows.</p>
          </div>

          <div style={issueCardStyle}>
            <h3>9. Partner Development Store Reinstall Note</h3>
            <p>Development store session tokens expire periodically. If GraphQL authorization errors occur after non-use, uninstall the app from Shopify Admin settings and launch <code>npm run dev</code> to re-issue clean OAuth credentials.</p>
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

const issueCardStyle: React.CSSProperties = {
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
