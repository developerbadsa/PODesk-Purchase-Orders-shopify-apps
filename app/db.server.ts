import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

function withServerlessPoolConfig(databaseUrl?: string) {
  if (!databaseUrl) {
    return undefined;
  }

  const sanitized = databaseUrl.trim().replace(/^["']|["']$/g, "");

  try {
    const url = new URL(sanitized);
    // connection_limit=1 is correct for serverless — each function invocation
    // gets its own short-lived connection. Avoid overwhelming the DB.
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    // Reduce pool_timeout from 30s — fail fast so Vercel can retry rather than
    // hanging for 30s on a cold DB connection.
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "10");
    }
    // Enable pgbouncer mode for connection pooling services (Neon, Supabase).
    // Only set if not already configured so users can opt out explicitly.
    if (!url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }

    return url.toString();
  } catch {
    return sanitized;
  }
}

function createPrismaClient() {
  const url = withServerlessPoolConfig(process.env.DATABASE_URL);

  return new PrismaClient(
    url
      ? {
          datasources: {
            db: { url },
          },
        }
      : undefined
  );
}

const prisma = global.prismaGlobal ?? createPrismaClient();
global.prismaGlobal = prisma;

export default prisma;
