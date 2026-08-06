import { isRouteErrorResponse } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

export function shopifyBoundaryError(error: unknown) {
  if (error instanceof Response && (error.status === 200 || error.status === 401)) {
    return boundary.error(error);
  }

  if (isRouteErrorResponse(error) && (error.status === 200 || error.status === 401)) {
    return boundary.error(error);
  }

  return null;
}
