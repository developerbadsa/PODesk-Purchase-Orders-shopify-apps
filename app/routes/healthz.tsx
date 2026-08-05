import type { LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get("token");
  const expectedToken = process.env.HEALTHCHECK_TOKEN;

  if (!expectedToken || tokenParam !== expectedToken) {
    return new Response("Not Found", { status: 404 });
  }

  let dbHost: string | null = null;
  const rawDbUrl = process.env.DATABASE_URL;
  const rawApiSecret = process.env.SHOPIFY_API_SECRET;
  const cleanedApiSecret = rawApiSecret?.trim().replace(/^["']|["']$/g, "");

  if (rawDbUrl) {
    try {
      const sanitized = rawDbUrl.trim().replace(/^["']|["']$/g, "");
      const parsed = new URL(sanitized);
      dbHost = parsed.hostname;
    } catch {
      dbHost = "invalid_url_format";
    }
  }

  let prismaSessionCount: number | null = null;
  let dbError: { name: string; message: string } | null = null;

  try {
    prismaSessionCount = await prisma.session.count();
  } catch (err: unknown) {
    const errorObj = err as Error;
    dbError = {
      name: errorObj.name || "UnknownError",
      message: errorObj.message || String(err),
    };
  }

  return Response.json({
    appUrlPresent: Boolean(process.env.SHOPIFY_APP_URL),
    apiKeyPresent: Boolean(process.env.SHOPIFY_API_KEY),
    apiSecretPresent: Boolean(cleanedApiSecret),
    apiSecretLength: cleanedApiSecret?.length ?? null,
    apiSecretHadWrappingQuotesOrWhitespace:
      Boolean(rawApiSecret) && rawApiSecret !== cleanedApiSecret,
    databaseUrlPresent: Boolean(process.env.DATABASE_URL),
    databaseHost: dbHost,
    prismaSessionCount,
    dbError,
  });
};


