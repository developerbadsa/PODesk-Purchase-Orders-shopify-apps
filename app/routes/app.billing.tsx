import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
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
    <s-page heading="Billing & Plans">
      <s-section heading="Current Plan Status">
        <div style={statusCardStyle}>
          <div style={statusLabelStyle}>Store: {shop}</div>
          <div style={planTitleStyle}>
            Current Plan: {subscription?.planName || "Development / Not configured"}
          </div>
          <div style={statusBadgeStyle}>
            {subscription?.status || "ACTIVE"}
          </div>
          <p style={mutedNoticeStyle}>
            Billing is not enforced in this development build. All core features remain unlocked for testing.
          </p>
        </div>
      </s-section>

      <s-section heading="Subscription Tiers & Pricing">
        <div style={gridStyle}>
          {/* Starter Plan */}
          <div style={planCardStyle}>
            <div style={badgeStyle}>Starter</div>
            <div style={priceStyle}>
              $39<span style={periodStyle}>/month</span>
            </div>
            <div style={trialStyle}>14-day free trial</div>
            <p style={descriptionStyle}>
              Essential purchase order workflow and inventory reorder planning for small growing stores.
            </p>
            <ul style={featureListStyle}>
              <li>Shopify product & variant sync</li>
              <li>Supplier management & contacts</li>
              <li>Basic purchase orders & printable POs</li>
              <li>Reorder planning table & alerts</li>
            </ul>
            <button type="button" disabled style={disabledButtonStyle}>
              Coming soon
            </button>
          </div>

          {/* Pro Plan */}
          <div style={{ ...planCardStyle, border: "2px solid #008060" }}>
            <div style={recommendedBadgeStyle}>Recommended</div>
            <div style={badgeStyle}>Pro</div>
            <div style={priceStyle}>
              $79<span style={periodStyle}>/month</span>
            </div>
            <div style={trialStyle}>14-day free trial</div>
            <p style={descriptionStyle}>
              Complete replenishment, receiving, SKU cost mappings, and supplier export tools.
            </p>
            <ul style={featureListStyle}>
              <li>Everything in Starter</li>
              <li>SKU-to-supplier cost & lead time mapping</li>
              <li>PO receiving workflow & partial receipts</li>
              <li>Interactive PO sharing & supplier email tools</li>
              <li>Configurable reorder velocity windows (7-90d)</li>
            </ul>
            <button type="button" disabled style={disabledButtonStyle}>
              Coming soon
            </button>
          </div>

          {/* Business Plan */}
          <div style={planCardStyle}>
            <div style={badgeStyle}>Business</div>
            <div style={priceStyle}>
              $149<span style={periodStyle}>/month</span>
            </div>
            <div style={trialStyle}>14-day free trial</div>
            <p style={descriptionStyle}>
              Advanced operations for multi-location stores, POS retailers, and heavy catalog volume.
            </p>
            <ul style={featureListStyle}>
              <li>Everything in Pro</li>
              <li>Stocky CSV supplier & SKU mapping import</li>
              <li>Multi-location inventory tracking</li>
              <li>Priority support & setup assistance</li>
            </ul>
            <button type="button" disabled style={disabledButtonStyle}>
              Coming soon
            </button>
          </div>

          {/* Migration Service */}
          <div style={{ ...planCardStyle, background: "#fafbfb" }}>
            <div style={badgeStyle}>Migration Service</div>
            <div style={priceStyle}>
              $299 - $999<span style={periodStyle}> one-time</span>
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

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
