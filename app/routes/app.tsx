import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Outlet,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticateAdmin } from "../authenticate-admin.server";

function cleanEnv(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, "");
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticateAdmin(request, "app-loader");

  // eslint-disable-next-line no-undef
  return { apiKey: cleanEnv(process.env.SHOPIFY_API_KEY) || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
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

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 200 || error.status === 401 || error.data === "200") {
      if (typeof window !== "undefined") {
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }
      return (
        <s-page heading="Session Refreshing">
          <s-section>
            <div style={{ padding: "32px", textAlign: "center", color: "#202223" }}>
              <p style={{ fontSize: "16px", marginBottom: "16px", fontWeight: 500 }}>
                Refreshing your Shopify session...
              </p>
              <button
                onClick={() => window.location.reload()}
                style={{
                  border: "0",
                  borderRadius: "6px",
                  padding: "10px 18px",
                  background: "#008060",
                  color: "#fff",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                Reload Page
              </button>
            </div>
          </s-section>
        </s-page>
      );
    }
  }

  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
