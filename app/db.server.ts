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

  // Do not enforce 1-connection limit in local dev; allow Prisma to pool connections normally for parallel Promise.all queries.
  if (!process.env.VERCEL) {
    return sanitized;
  }

  try {
    const url = new URL(sanitized);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "10");
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
