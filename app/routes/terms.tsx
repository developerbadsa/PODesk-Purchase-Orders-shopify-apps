import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "Terms of Service | PODesk: Purchase Orders" },
    { name: "description", content: "Terms of Service for PODesk: Purchase Orders Shopify app." },
  ];
};

export default function TermsPage() {
  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: "0 0 8px 0", fontSize: "28px" }}>Terms of Service</h1>
        <p style={{ margin: 0, color: "#616161", fontSize: "14px" }}>
          <strong>PODesk: Purchase Orders</strong> &bull; Effective Date: August 2, 2026
        </p>
      </header>

      <div style={disclaimerBoxStyle}>
        <strong>LEGAL DISCLAIMER:</strong> This Terms of Service document is a draft template created for Shopify App Store review readiness. It does not constitute formal legal advice. App operators should consult qualified legal counsel prior to commercial launch.
      </div>

      <main style={contentStyle}>
        <section style={sectionStyle}>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By installing or using <strong>PODesk: Purchase Orders</strong> (&quot;the App&quot;), you (&quot;Merchant&quot; or &quot;User&quot;) agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you must uninstall the App immediately.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>2. Free Beta Status</h2>
          <p>The App is currently offered in a <strong>Free Beta</strong> stage.</p>
          <ul>
            <li>During the beta period, access to all active features is provided free of charge.</li>
            <li>The App is provided on an <strong>&quot;AS IS&quot;</strong> and <strong>&quot;AS AVAILABLE&quot;</strong> basis without warranties of any kind, whether express, implied, or statutory.</li>
            <li>Features, user interface, reorder algorithms, and functionality may be modified, updated, or temporarily suspended as we refine the software.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2>3. No Guarantee of Forecast or Reorder Accuracy</h2>
          <p>
            PODesk provides reorder quantity suggestions based on mathematical formulas (target stocking days &times; daily sales velocity &minus; aggregate current inventory).
          </p>
          <div style={{ background: "#f5f5f5", padding: "12px 16px", borderLeft: "4px solid #1976d2", margin: "12px 0" }}>
            <strong>Important Merchant Responsibilities:</strong>
            <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
              <li>Reorder calculations are intended as operational assistance tools only.</li>
              <li><strong>The Merchant is solely responsible for verifying all purchase order quantities, supplier pricing, lead times, minimum order quantities, and supplier details before placing orders with suppliers.</strong></li>
              <li>We make no representation or warranty that suggested reorder quantities will prevent stockouts, eliminate excess inventory, or result in commercial profitability.</li>
              <li>We are not liable for lost profits, stockouts, overstocking fees, supplier pricing errors, or shipping delays.</li>
            </ul>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2>4. Read-Only Shopify Inventory in Current Beta</h2>
          <p>In the current version, the App operates on a <strong>read-only</strong> basis regarding your Shopify store inventory and products.</p>
          <ul>
            <li>The App reads inventory counts and recent sales velocity to calculate recommendations.</li>
            <li><strong>The App does not write inventory levels back to your Shopify store.</strong></li>
            <li>Adjusting receiving quantities or purchase order statuses within PODesk updates records inside PODesk only, and does not alter Shopify admin stock numbers.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2>5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the App for any unlawful, fraudulent, or unauthorized purpose.</li>
            <li>Attempt to decompile, reverse engineer, or extract source code from the App.</li>
            <li>Interfere with or disrupt the integrity, security, or performance of the App infrastructure.</li>
            <li>Use automated scraping or bots to access or overwhelm the service.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2>6. Limitation of Liability</h2>
          <p>To the maximum extent permitted by applicable law:</p>
          <ul>
            <li>In no event shall the App operator, its directors, employees, or partners be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, goodwill, or business interruption.</li>
            <li>Our total aggregate liability for any claims arising out of or relating to the App shall not exceed the total fees paid by you to us for the App in the twelve (12) months preceding the claim, or <strong>$50.00 USD</strong>, whichever is greater.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2>7. Support &amp; Service Availability</h2>
          <p>
            Support is provided on a best-effort basis via email during the beta period. While we strive to maintain high system availability, we do not guarantee uninterrupted access or specific resolution response times.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>8. Future Paid Subscription Plans</h2>
          <p>
            We reserve the right to introduce paid subscription plans or feature-tiered pricing in the future. Merchants will be provided advance written notice prior to the activation of any paid subscription requirements.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>9. Termination</h2>
          <p>
            You may terminate these Terms at any time by uninstalling the App from your Shopify store. We reserve the right to suspend or terminate access to the App for any user who violates these Terms or engages in abusive behavior, without prior notice.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2>10. Contact Information</h2>
          <p>For inquiries regarding these Terms of Service:</p>
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
