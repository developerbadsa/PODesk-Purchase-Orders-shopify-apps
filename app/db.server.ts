import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

function withServerlessPoolConfig(databaseUrl?: string) {
  if (!databaseUrl) {
    return undefined;
  }

  try {
    const url = new URL(databaseUrl);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "30");
    }

    return url.toString();
  } catch {
    return databaseUrl;
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
