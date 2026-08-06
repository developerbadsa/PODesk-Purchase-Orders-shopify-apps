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

  // In production-like serverless environments, we need to adjust the connection pool settings.
  // In local development, allow Prisma to pool connections normally.
  if (process.env.NODE_ENV !== "production") {
    return sanitized;
  }

  try {
    const url = new URL(sanitized);
    // Keep the pool small for serverless, but do not allow an explicit
    // connection_limit=1 to make one request's parallel reads starve itself.
    const connectionLimit = Number(url.searchParams.get("connection_limit"));
    if (!Number.isFinite(connectionLimit) || connectionLimit < 3) {
      url.searchParams.set("connection_limit", "3");
    }

    const poolTimeout = Number(url.searchParams.get("pool_timeout"));
    if (!Number.isFinite(poolTimeout) || poolTimeout < 30) {
      url.searchParams.set("pool_timeout", "30");
    }
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
