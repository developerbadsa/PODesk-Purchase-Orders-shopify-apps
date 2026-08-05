import { redirect } from "react-router";

const RECOVERY_PARAM = "podesk_auth_retry";
const SESSION_TOKEN_PATH = "/auth/session-token";

const RESTRICTED_RELOAD_PARAMS = [
  "hmac",
  "id_token",
  "protocol",
  "session",
  "timestamp",
];

export function recoverFromInvalidEmbeddedSession(
  request: Request,
  error: unknown
): Response | null {
  if (
    !(error instanceof Response) ||
    error.status !== 401
  ) {
    return null;
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const host = url.searchParams.get("host");
  const isEmbedded = url.searchParams.get("embedded") === "1";
  const alreadyRetried = url.searchParams.get(RECOVERY_PARAM) === "1";

  if (!shop || !host || !isEmbedded || alreadyRetried) {
    return null;
  }

  const reloadUrl = new URL(request.url);
  for (const param of RESTRICTED_RELOAD_PARAMS) {
    reloadUrl.searchParams.delete(param);
  }
  reloadUrl.searchParams.set(RECOVERY_PARAM, "1");

  const bounceUrl = new URL(SESSION_TOKEN_PATH, url.origin);
  bounceUrl.searchParams.set("shop", shop);
  bounceUrl.searchParams.set("embedded", "1");
  bounceUrl.searchParams.set("host", host);
  bounceUrl.searchParams.set("shopify-reload", reloadUrl.toString());

  console.warn("[PODesk auth] recovering invalid embedded session", {
    shop,
    path: url.pathname,
    retryParam: RECOVERY_PARAM,
  });

  return redirect(`${bounceUrl.pathname}?${bounceUrl.searchParams.toString()}`);
}
