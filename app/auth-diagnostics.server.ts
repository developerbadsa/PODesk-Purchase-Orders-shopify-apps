function summarizeRequest(request: Request) {
  const url = new URL(request.url);
  const authorization = request.headers.get("authorization");
  const referer = request.headers.get("referer");

  return {
    method: request.method,
    path: url.pathname,
    shop: url.searchParams.get("shop"),
    embedded: url.searchParams.get("embedded") === "1",
    hasHost: url.searchParams.has("host"),
    hasHmac: url.searchParams.has("hmac"),
    hasLegacySessionParam: url.searchParams.has("session"),
    hasIdToken: url.searchParams.has("id_token"),
    hasAuthorization: Boolean(authorization),
    authorizationType: authorization?.startsWith("Bearer ") ? "Bearer" : authorization ? "Other" : "None",
    hasShopifyBounceHeader: request.headers.has("x-shopify-bounce"),
    refererOrigin: referer ? safeOrigin(referer) : null,
  };
}

function safeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "invalid";
  }
}

function summarizeThrown(error: unknown) {
  if (error instanceof Response) {
    return {
      type: "Response",
      status: error.status,
      statusText: error.statusText,
      location: error.headers.get("location"),
      retryInvalidSession: error.headers.get("x-shopify-retry-invalid-session-request"),
      contentType: error.headers.get("content-type"),
    };
  }

  if (error instanceof Error) {
    return {
      type: error.name,
      message: error.message,
    };
  }

  return {
    type: typeof error,
    message: String(error),
  };
}

export function logAuthRequest(label: string, request: Request) {
  console.log(`[PODesk auth] ${label}`, summarizeRequest(request));
}

export function logAuthSuccess(label: string, request: Request, shop?: string) {
  console.log(`[PODesk auth] ${label}`, {
    ...summarizeRequest(request),
    authenticatedShop: shop,
  });
}

export function logAuthFailure(label: string, request: Request, error: unknown) {
  console.warn(`[PODesk auth] ${label}`, {
    ...summarizeRequest(request),
    thrown: summarizeThrown(error),
  });
}
