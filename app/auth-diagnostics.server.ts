import { createHmac, timingSafeEqual } from "node:crypto";

function summarizeRequest(request: Request) {
  const url = new URL(request.url);
  const authorization = request.headers.get("authorization");
  const referer = request.headers.get("referer");
  const tokenSummary = summarizeSessionToken(request);
  const configuredApiSecret = cleanEnv(process.env.SHOPIFY_API_SECRET) || "";

  return {
    method: request.method,
    path: url.pathname,
    shop: url.searchParams.get("shop"),
    embedded: url.searchParams.get("embedded") === "1",
    hasHost: url.searchParams.has("host"),
    hasHmac: url.searchParams.has("hmac"),
    queryHmacMatchesConfiguredSecret: configuredApiSecret
      ? verifyShopifyQueryHmac(url.searchParams, configuredApiSecret)
      : null,
    hasLegacySessionParam: url.searchParams.has("session"),
    hasIdToken: url.searchParams.has("id_token"),
    hasAuthorization: Boolean(authorization),
    authorizationType: authorization?.startsWith("Bearer ") ? "Bearer" : authorization ? "Other" : "None",
    hasShopifyBounceHeader: request.headers.has("x-shopify-bounce"),
    refererOrigin: referer ? safeOrigin(referer) : null,
    ...tokenSummary,
  };
}

function shouldLogAuthDiagnostics() {
  return process.env.AUTH_DIAGNOSTICS === "1";
}

function safeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "invalid";
  }
}

function summarizeSessionToken(request: Request) {
  const url = new URL(request.url);
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  const idToken = url.searchParams.get("id_token");
  const token = bearerToken || idToken;

  if (!token) {
    return {
      sessionTokenSource: null,
    };
  }

  const payload = decodeJwtPayload(token);
  const configuredApiKey = cleanEnv(process.env.SHOPIFY_API_KEY) || "";
  const configuredApiSecret = cleanEnv(process.env.SHOPIFY_API_SECRET) || "";
  const nowSeconds = Math.floor(Date.now() / 1000);

  return {
    sessionTokenSource: bearerToken ? "authorization" : "id_token",
    tokenSignatureMatchesConfiguredSecret: configuredApiSecret
      ? verifyJwtHs256(token, configuredApiSecret)
      : null,
    tokenAudMatchesConfiguredApiKey:
      typeof payload?.aud === "string" && Boolean(configuredApiKey)
        ? payload.aud === configuredApiKey
        : null,
    tokenAudSuffix: typeof payload?.aud === "string" ? maskSuffix(payload.aud) : null,
    configuredApiKeySuffix: configuredApiKey ? maskSuffix(configuredApiKey) : null,
    tokenDestHost: typeof payload?.dest === "string" ? safeHost(payload.dest) : null,
    tokenIssHost: typeof payload?.iss === "string" ? safeHost(payload.iss) : null,
    tokenExpInSeconds:
      typeof payload?.exp === "number" ? payload.exp - nowSeconds : null,
    tokenNbfInSeconds:
      typeof payload?.nbf === "number" ? payload.nbf - nowSeconds : null,
  };
}

function cleanEnv(value?: string) {
  return value?.trim().replace(/^["']|["']$/g, "");
}

function verifyJwtHs256(token: string, secret: string): boolean | null {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    return null;
  }

  try {
    const expectedSignature = createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");

    return safeStringEqual(expectedSignature, signature);
  } catch {
    return null;
  }
}

function verifyShopifyQueryHmac(
  searchParams: URLSearchParams,
  secret: string
): boolean | null {
  const receivedHmac = searchParams.get("hmac");

  if (!receivedHmac) {
    return null;
  }

  try {
    const message = Array.from(searchParams.entries())
      .filter(([key]) => key !== "hmac" && key !== "signature")
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
        const keyCompare = leftKey.localeCompare(rightKey);
        return keyCompare === 0 ? leftValue.localeCompare(rightValue) : keyCompare;
      })
      .map(([key, value]) => `${key}=${value}`)
      .join("&");

    const expectedHmac = createHmac("sha256", secret)
      .update(message)
      .digest("hex");

    return safeStringEqual(expectedHmac, receivedHmac);
  } catch {
    return null;
  }
}

function safeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const payloadSegment = token.split(".")[1];

  if (!payloadSegment) return null;

  try {
    const normalized = payloadSegment
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payloadSegment.length / 4) * 4, "=");
    const json = Buffer.from(normalized, "base64").toString("utf8");

    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function maskSuffix(value: string) {
  return value.length > 6 ? `...${value.slice(-6)}` : "***";
}

function safeHost(value: string) {
  try {
    return new URL(value).host;
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
  if (!shouldLogAuthDiagnostics()) return;
  console.log(`[PODesk auth] ${label}`, summarizeRequest(request));
}

export function logAuthSuccess(label: string, request: Request, shop?: string) {
  if (!shouldLogAuthDiagnostics()) return;
  console.log(`[PODesk auth] ${label}`, {
    ...summarizeRequest(request),
    authenticatedShop: shop,
  });
}

export function logAuthFailure(label: string, request: Request, error: unknown) {
  if (!shouldLogAuthDiagnostics()) {
    // Always log a minimal warning even without diagnostics, but skip the
    // expensive summarizeRequest() call (JWT decode + HMAC crypto ops).
    console.warn(`[PODesk auth] ${label}`, summarizeThrown(error));
    return;
  }
  console.warn(`[PODesk auth] ${label}`, {
    ...summarizeRequest(request),
    thrown: summarizeThrown(error),
  });
}
