import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  isRouteErrorResponse,
  Outlet,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
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

  if (isRouteErrorResponse(error) && error.status === 401) {
    return (
      <main
        style={{
          display: "grid",
          gap: "12px",
          padding: "40px",
          maxWidth: "720px",
        }}
      >
        <h1 style={{ margin: 0 }}>Reconnect PODesk</h1>
        <p style={{ margin: 0, lineHeight: 1.5 }}>
          Shopify could not verify the current app session. This usually happens
          after reinstalling a development app or changing production
          configuration.
        </p>
        <a href="/" target="_top" rel="noreferrer">
          Open PODesk login
        </a>
      </main>
    );
  }

  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
