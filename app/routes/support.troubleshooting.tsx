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
        <img
          src="/brand/podesk-logo-horizontal.png"
          alt="PODesk"
          style={{ maxWidth: "200px", height: "auto", display: "block", marginBottom: "16px" }}
        />
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px" }}>Troubleshooting PODesk</h1>
        <p style={{ margin: 0, color: "#616161", fontSize: "14px" }}>
          <strong>PODesk: Purchase Orders</strong> &bull; Merchant &amp; Developer Troubleshooting Guide
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
            Ran into a hiccup or an unexpected message while using PODesk? Here are direct solutions to the most common issues merchants and developers run into.
          </p>

          <div style={issueCardStyle}>
            <h3>1. App shows a blank white screen or won&apos;t finish loading</h3>
            <p><strong>Why it happens:</strong> Your browser session token expired or your browser&apos;s privacy settings are blocking cookies inside Shopify&apos;s admin frame.</p>
            <p><strong>How to fix it:</strong></p>
            <ol>
              <li>Try a hard refresh (<code>Ctrl + Shift + R</code> on Windows/Linux or <code>Cmd + Shift + R</code> on Mac).</li>
              <li>Make sure third-party cookies or cross-site tracking protections aren&apos;t blocking <code>admin.shopify.com</code>.</li>
              <li>Try opening Shopify Admin in an Incognito / Private window.</li>
            </ol>
          </div>

          <div style={issueCardStyle}>
            <h3>2. &quot;Access Denied&quot; scope errors when running inventory sync</h3>
            <p><strong>Why it happens:</strong> Your store has an older login token saved from before we updated access scopes in <code>shopify.app.toml</code>.</p>
            <p><strong>How to fix it:</strong></p>
            <ol>
              <li>In Shopify Admin, go to <strong>Settings &gt; Apps and sales channels</strong>.</li>
              <li>Find <strong>PODesk: Purchase Orders</strong> and click <strong>Uninstall</strong>.</li>
              <li>If running local CLI dev, press <code>q</code> to stop your server, then restart with: <code>npm run dev -- --reset</code>.</li>
              <li>Re-install PODesk on your test store and accept the updated permission prompt.</li>
              <li>Open PODesk and click <strong>Sync Shopify inventory</strong> again.</li>
            </ol>
          </div>

          <div style={issueCardStyle}>
            <h3>3. Inventory sync fails or hits query cost limits</h3>
            <p><strong>Why it happens:</strong> Your catalog or order volume is large, hitting Shopify GraphQL API rate limits.</p>
            <p><strong>How to fix it:</strong> PODesk syncs up to 1,000 products and 1,000 orders per single sync pass. If your catalog has over 5,000 SKUs, wait about 60 seconds for Shopify&apos;s API limit bucket to refill, then run the sync again.</p>
          </div>

          <div style={issueCardStyle}>
            <h3>4. No products showing up after sync completes</h3>
            <p><strong>Why it happens:</strong> Your Shopify items might be missing SKUs, set to Draft, or untracked.</p>
            <p><strong>How to fix it:</strong></p>
            <ol>
              <li>Make sure your product variants in Shopify Admin have <strong>SKUs</strong> filled in. PODesk relies on SKUs to map items.</li>
              <li>Confirm products are set to <strong>Active</strong> (Draft or Archived items are skipped).</li>
              <li>Check that variants have <strong>Track quantity</strong> enabled in Shopify.</li>
            </ol>
          </div>

          <div style={issueCardStyle}>
            <h3>5. Reorder table shows no suggestions or &quot;Map supplier first&quot;</h3>
            <p><strong>Why it happens:</strong> Either the item isn&apos;t linked to a vendor, or there were zero sales in your chosen window.</p>
            <p><strong>How to fix it:</strong></p>
            <ol>
              <li><strong>Link a Supplier:</strong> Go to <code>/app/mappings</code> and map the SKU to a supplier. We need lead times to estimate risk.</li>
              <li><strong>Expand Sales Window:</strong> If an item didn&apos;t sell in 30 days, try selecting a 90-day window.</li>
              <li><strong>Use Manual Override:</strong> Enter your own number in the <strong>Reorder Override</strong> field on <code>/app/reorder</code>.</li>
            </ol>
          </div>

          <div style={issueCardStyle}>
            <h3>6. CSV import skipping rows or throwing errors</h3>
            <p><strong>Why it happens:</strong> Column names don&apos;t match, or SKUs in your file don&apos;t exist in Shopify.</p>
            <p><strong>How to fix it:</strong></p>
            <ol>
              <li>Make sure your headers match or use the column dropdowns on the preview page. Required columns: <code>handle</code> or <code>sku</code>, and <code>supplier_name</code>.</li>
              <li>Check that the SKUs in your spreadsheet match your Shopify SKUs character-for-character.</li>
              <li>Click <strong>Export Invalid Rows</strong> on the import page to get a CSV listing only the failed rows with exact reasons.</li>
            </ol>
          </div>

          <div style={issueCardStyle}>
            <h3>7. Purchase order won&apos;t record item receiving</h3>
            <p><strong>Why it happens:</strong> The PO is still in Draft state or entered numbers exceed what&apos;s left.</p>
            <p><strong>How to fix it:</strong> Make sure the PO status is <code>SENT</code>, <code>CONFIRMED</code>, or <code>PARTIALLY_RECEIVED</code>. Click <strong>Mark as Sent</strong> first if it&apos;s still a Draft, and ensure received quantities don&apos;t exceed the remaining balance.</p>
          </div>

          <div style={issueCardStyle}>
            <h3>8. Can&apos;t select items from different suppliers for one PO</h3>
            <p><strong>Why it happens:</strong> A single purchase order can only be sent to one vendor at a time.</p>
            <p><strong>How to fix it:</strong> Use the <strong>Supplier Filter</strong> dropdown at the top of the Reorder table to filter by a single vendor before selecting checkboxes.</p>
          </div>

          <div style={issueCardStyle}>
            <h3>9. Session token expired on dev store</h3>
            <p>If you&apos;re testing on a Partner Development store, tokens expire after non-use. Simply uninstall the app from Shopify Admin settings and restart <code>npm run dev</code> to generate a fresh token.</p>
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


