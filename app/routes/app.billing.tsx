import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData , useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "billing-loader");
  const store = await prisma.store.findUnique({
    where: { shop: session.shop },
    include: { billingSubscription: true },
  });

  return {
    shop: session.shop,
    subscription: store?.billingSubscription ?? null,
  };
};

export default function BillingPage() {
  const { shop, subscription } = useLoaderData<typeof loader>();

  return (
    <s-page full-width heading="Billing & Plans">
      <s-section heading="Current Plan Status">
        <div style={statusCardStyle}>
          <div style={statusLabelStyle}>Store: {shop}</div>
          <div style={planTitleStyle}>
            Current Plan: Free Beta ({subscription?.planName || "Development Build"})
          </div>
          <div style={statusBadgeStyle}>
            FREE BETA ACCESS
          </div>
          <p style={mutedNoticeStyle}>
            PODesk is free during beta. Billing is not enforced in this development build. All features (Inventory Sync, Suppliers, Mappings, Purchase Orders, Receiving, Reorder Planning, and CSV Import) are fully unlocked and free to use.
          </p>
          <div style={{ marginTop: "8px", fontSize: "12px", color: "#6d7175" }}>
            Note: The subscription tiers below represent planned post-launch pricing and are currently inactive.
          </div>
        </div>
      </s-section>

      <s-section heading="Subscription Tiers & Pricing">
        <div style={gridStyle}>
          {/* Free Starter Plan */}
          <div style={planCardStyle}>
            <div style={badgeStyle}>Free / Starter</div>
            <div style={priceStyle}>
              $0<span style={periodStyle}>/month</span>
            </div>
            <div style={freeTrialStyle}>Free forever</div>
            <p style={descriptionStyle}>
              Full-featured purchase order workflow and replenishment planning for growing Shopify stores.
            </p>
            <ul style={featureListStyle}>
              <li>Shopify product, variant & inventory sync</li>
              <li>Unlimited supplier management & contacts</li>
              <li>Unlimited purchase orders & printable PO PDFs</li>
              <li>SKU-to-supplier cost & lead time mapping</li>
              <li>Reorder velocity planning table & stockout alerts</li>
              <li>Interactive PO sharing & supplier email tools</li>
              <li>CSV sample templates & basic import preview</li>
            </ul>
            <button type="button" disabled style={disabledButtonStyle}>
              Included
            </button>
          </div>

          {/* Pro Plan */}
          <div style={{ ...planCardStyle, border: "2px solid #008060" }}>
            <div style={recommendedBadgeStyle}>Recommended</div>
            <div style={badgeStyle}>Pro</div>
            <div style={priceStyle}>
              $19<span style={periodStyle}>/month</span>
            </div>
            <div style={trialStyle}>14-day free trial</div>
            <p style={descriptionStyle}>
              Complete replenishment, partial receiving workflows, custom branding, and velocity customization.
            </p>
            <ul style={featureListStyle}>
              <li>Everything in Free</li>
              <li>PO receiving workflow & partial receipt tracking</li>
              <li>Configurable reorder velocity windows (7-90d)</li>
              <li>Custom PO reference prefix & company branding</li>
              <li>Stocky CSV bulk supplier & SKU mapping import</li>
              <li>Historical receiving logs & cost analysis</li>
            </ul>
            <button type="button" disabled style={disabledButtonStyle}>
              Coming soon
            </button>
          </div>

          {/* Business Plan */}
          <div style={planCardStyle}>
            <div style={badgeStyle}>Business</div>
            <div style={priceStyle}>
              $39<span style={periodStyle}>/month</span>
            </div>
            <div style={trialStyle}>14-day free trial</div>
            <p style={descriptionStyle}>
              Advanced operations for multi-location stores, POS retailers, and heavy catalog volume.
            </p>
            <ul style={featureListStyle}>
              <li>Everything in Pro</li>
              <li>Multi-location inventory tracking & location filters</li>
              <li>Auto-reorder suggestions & bulk PO generator</li>
              <li>Priority 1-on-1 support & setup assistance</li>
            </ul>
            <button type="button" disabled style={disabledButtonStyle}>
              Coming soon
            </button>
          </div>

          {/* Migration Service */}
          <div style={{ ...planCardStyle, background: "#fafbfb" }}>
            <div style={badgeStyle}>Migration Service</div>
            <div style={priceStyle}>
              $79<span style={periodStyle}> one-time</span>
            </div>
            <div style={trialStyle}>Managed setup</div>
            <p style={descriptionStyle}>
              White-glove migration assistance for Stocky users and legacy spreadsheet workflows.
            </p>
            <ul style={featureListStyle}>
              <li>Data extraction & CSV cleaning</li>
              <li>Supplier & SKU mapping verification</li>
              <li>PO template customization</li>
              <li>1-on-1 team onboarding call</li>
            </ul>
            <button type="button" disabled style={disabledButtonStyle}>
              Coming soon
            </button>
          </div>
        </div>
      </s-section>
    </s-page>
  );
}

// Inline Styles
const statusCardStyle = {
  border: "1px solid #dfe3e8",
  borderRadius: "8px",
  padding: "16px",
  background: "#ffffff",
} as const;

const statusLabelStyle = {
  color: "#6d7175",
  fontSize: "13px",
  fontWeight: 600,
} as const;

const planTitleStyle = {
  fontSize: "18px",
  fontWeight: 700,
  margin: "6px 0",
} as const;

const statusBadgeStyle = {
  display: "inline-block",
  background: "#effaf5",
  color: "#0f5132",
  padding: "2px 8px",
  borderRadius: "4px",
  fontSize: "12px",
  fontWeight: 600,
  marginBottom: "8px",
} as const;

const mutedNoticeStyle = {
  color: "#5c5f62",
  fontSize: "13px",
  margin: "4px 0 0 0",
} as const;

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "16px",
} as const;

const planCardStyle = {
  position: "relative",
  border: "1px solid #dfe3e8",
  borderRadius: "8px",
  padding: "20px",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
} as const;

const badgeStyle = {
  fontSize: "14px",
  fontWeight: 700,
  color: "#202223",
  marginBottom: "4px",
} as const;

const recommendedBadgeStyle = {
  position: "absolute",
  top: "-12px",
  right: "16px",
  background: "#008060",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: 700,
  padding: "2px 8px",
  borderRadius: "12px",
  textTransform: "uppercase",
} as const;

const priceStyle = {
  fontSize: "26px",
  fontWeight: 800,
  color: "#1a1a1a",
} as const;

const periodStyle = {
  fontSize: "14px",
  fontWeight: 400,
  color: "#6d7175",
} as const;

const trialStyle = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#008060",
  marginBottom: "12px",
} as const;

const freeTrialStyle = {
  ...trialStyle,
  color: "#108043",
} as const;

const descriptionStyle = {
  fontSize: "13px",
  color: "#5c5f62",
  marginBottom: "14px",
  lineHeight: 1.4,
} as const;

const featureListStyle = {
  paddingLeft: "18px",
  margin: "0 0 20px 0",
  fontSize: "13px",
  color: "#303030",
  lineHeight: 1.6,
  flexGrow: 1,
} as const;

const disabledButtonStyle = {
  border: "1px solid #c9cccf",
  borderRadius: "6px",
  padding: "10px 14px",
  background: "#f6f6f7",
  color: "#8c9196",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "not-allowed",
  width: "100%",
} as const;


// Shopify requires ErrorBoundary on every route that calls authenticate.admin
// so that thrown 200/401 responses (App Bridge re-auth) are handled correctly.
export function ErrorBoundary() {
  const error = useRouteError();
  const boundaryError = boundary.error(error);
  if (error instanceof Response && (error.status === 200 || error.status === 401)) {
    return boundaryError;
  }
  let msg = "Unknown error";
  let stack = "";
  if (error instanceof Error) {
    msg = error.message;
    stack = error.stack || "";
  } else if (error instanceof Response) {
    msg = `${error.status} ${error.statusText}`;
  } else {
    msg = JSON.stringify(error);
  }
  return (
    <div style={{ padding: "20px", color: "#8a1f11", background: "#fff4f4", margin: "20px", borderRadius: "8px", border: "1px solid #e0b3b2", fontFamily: "monospace", overflowX: "auto" }}>
      <h2 style={{ margin: "0 0 10px 0" }}>Runtime Error</h2>
      <div style={{ fontWeight: "bold", marginBottom: "10px" }}>{msg}</div>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", background: "#f9e5e5", padding: "10px", borderRadius: "4px" }}>
        {stack || JSON.stringify(error, null, 2)}
      </pre>
    </div>
  );
}
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};


