
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  logAuthFailure,
  logAuthRequest,
  logAuthSuccess,
} from "../auth-diagnostics.server";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  logAuthRequest("auth-catchall:start", request);

  try {
    const { session } = await authenticate.admin(request);
    logAuthSuccess("auth-catchall:success", request, session.shop);
  } catch (error) {
    logAuthFailure("auth-catchall:thrown", request, error);
    throw error;
  }

  return null;
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
