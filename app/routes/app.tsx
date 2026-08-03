import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Outlet,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { recoverFromInvalidEmbeddedSession } from "../auth-recovery.server";
import {
  logAuthFailure,
  logAuthRequest,
  logAuthSuccess,
} from "../auth-diagnostics.server";
import { authenticate } from "../shopify.server";

function cleanEnv(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, "");
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  logAuthRequest("app-loader:start", request);

  try {
    const { session } = await authenticate.admin(request);
    logAuthSuccess("app-loader:success", request, session.shop);
  } catch (error) {
    logAuthFailure("app-loader:thrown", request, error);
    const recoveryResponse = recoverFromInvalidEmbeddedSession(request, error);

    if (recoveryResponse) {
      throw recoveryResponse;
    }

    throw error;
  }

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

  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
