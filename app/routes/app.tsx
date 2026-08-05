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
    const delay = isBusy ? 250 : 0;
    const timeoutId = window.setTimeout(() => setIsVisible(isBusy), delay);
    return () => window.clearTimeout(timeoutId);
  }, [isBusy]);

  if (!isVisible) {
    return null;
  }

  const message =
    state === "submitting" ? "Saving changes..." : "Loading store data...";

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
      <BarLoader
        color="#008060"
        height={3}
        speedMultiplier={0.9}
        width="100%"
        cssOverride={{ display: "block" }}
      />
      <div
        style={{
          position: "absolute",
          insetBlockStart: 14,
          insetInlineEnd: 18,
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: "1px solid #d8dbdf",
          borderRadius: 8,
          background: "#ffffff",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
          color: "#202223",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: "20px",
          padding: "10px 14px",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#008060",
            boxShadow: "0 0 0 4px rgba(0, 128, 96, 0.14)",
          }}
        />
        {message}
      </div>
    </div>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
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


