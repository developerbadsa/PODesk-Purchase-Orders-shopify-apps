import type { HeadersFunction } from "react-router";
import {
  Outlet,
  useLoaderData,
  useNavigation,
  useRouteError,
} from "react-router";
import { useEffect, useState } from "react";
import BarLoader from "react-spinners/BarLoader";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { shopifyBoundaryError } from "../shopify-boundary";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

function cleanEnv(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, "");
}

export const loader = async () => {
  // eslint-disable-next-line no-undef
  return { apiKey: cleanEnv(process.env.SHOPIFY_API_KEY) || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isBusy = navigation.state !== "idle";

  return (
    <AppProvider embedded apiKey={apiKey}>
      <GlobalRouteLoader isBusy={isBusy} state={navigation.state} />
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/suppliers">Suppliers</s-link>
        <s-link href="/app/mappings">SKU mappings</s-link>
        <s-link href="/app/purchase-orders">Purchase orders</s-link>
        <s-link href="/app/reorder">Reorder planning</s-link>
        <s-link href="/app/imports">Stocky import</s-link>
        <s-link href="/app/settings">Settings</s-link>
        <s-link href="/app/billing">Billing</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

function GlobalRouteLoader({
  isBusy,
  state,
}: {
  isBusy: boolean;
  state: "idle" | "loading" | "submitting";
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(isBusy);
  }, [isBusy]);

  if (!isVisible) {
    return null;
  }

  const message =
    state === "submitting" ? "Saving changes..." : "Loading page data...";

  return (
    <div
      aria-live="polite"
      aria-busy="true"
      role="status"
      style={{
        position: "fixed",
        insetBlockStart: 0,
        insetInline: 0,
        zIndex: 2147483647,
        pointerEvents: "none",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes spinSlow {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `,
        }}
      />
      {/* Dynamic Animated BarLoader Progress Line */}
      <BarLoader
        color="#008060"
        height={4}
        speedMultiplier={1.3}
        width="100%"
        cssOverride={{ display: "block", boxShadow: "0 0 10px rgba(0, 128, 96, 0.4)" }}
      />
      {/* Centered Glassmorphic Loading Pill Badge */}
      <div
        style={{
          position: "fixed",
          top: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          borderRadius: "999px",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(0, 128, 96, 0.25)",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
          color: "#111827",
          fontSize: "13px",
          fontWeight: 650,
          padding: "8px 18px",
        }}
      >
        <svg
          style={{ animation: "spinSlow 0.9s linear infinite", width: "16px", height: "16px", color: "#008060" }}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path style={{ opacity: 0.85 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span>{message}</span>
      </div>
    </div>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();
  const shopifyError = shopifyBoundaryError(error);
  if (shopifyError) return shopifyError;
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


