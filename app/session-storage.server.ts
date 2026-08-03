import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import type { PrismaClient, Session as SessionRow } from "@prisma/client";

const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 350;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return String(error);
}

async function withRetries<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DEFAULT_RETRIES; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(
        `[PODesk session storage] ${operation} failed on attempt ${attempt}/${DEFAULT_RETRIES}: ${serializeError(error)}`
      );

      if (attempt < DEFAULT_RETRIES) {
        await sleep(DEFAULT_RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw lastError;
}

function sessionToRow(session: Session): SessionRow {
  const sessionParams = session.toObject();
  const associatedUser = sessionParams.onlineAccessInfo?.associated_user;

  return {
    id: session.id,
    shop: session.shop,
    state: session.state,
    isOnline: session.isOnline,
    scope: session.scope ?? null,
    expires: session.expires ?? null,
    accessToken: session.accessToken ?? "",
    userId: associatedUser?.id ? BigInt(associatedUser.id) : null,
    firstName: associatedUser?.first_name ?? null,
    lastName: associatedUser?.last_name ?? null,
    email: associatedUser?.email ?? null,
    accountOwner: associatedUser?.account_owner ?? false,
    locale: associatedUser?.locale ?? null,
    collaborator: associatedUser?.collaborator ?? false,
    emailVerified: associatedUser?.email_verified ?? false,
    refreshToken: sessionParams.refreshToken ?? null,
    refreshTokenExpires: sessionParams.refreshTokenExpires ?? null,
  };
}

function rowToSession(row: SessionRow): Session {
  const entries: [string, string | number | boolean][] = [
    ["id", row.id],
    ["shop", row.shop],
    ["state", row.state],
    ["isOnline", row.isOnline],
  ];

  if (row.scope) entries.push(["scope", row.scope]);
  if (row.expires) entries.push(["expires", row.expires.getTime()]);
  if (row.accessToken) entries.push(["accessToken", row.accessToken]);
  if (row.userId) entries.push(["userId", row.userId.toString()]);
  if (row.firstName) entries.push(["firstName", row.firstName]);
  if (row.lastName) entries.push(["lastName", row.lastName]);
  if (row.email) entries.push(["email", row.email]);
  if (row.accountOwner !== null) entries.push(["accountOwner", row.accountOwner]);
  if (row.locale) entries.push(["locale", row.locale]);
  if (row.collaborator !== null) entries.push(["collaborator", row.collaborator]);
  if (row.emailVerified !== null) entries.push(["emailVerified", row.emailVerified]);
  if (row.refreshToken) entries.push(["refreshToken", row.refreshToken]);
  if (row.refreshTokenExpires) {
    entries.push(["refreshTokenExpires", row.refreshTokenExpires.getTime()]);
  }

  return Session.fromPropertyArray(entries, true);
}

export class ResilientPrismaSessionStorage implements SessionStorage {
  constructor(private readonly prisma: PrismaClient) {}

  async storeSession(session: Session): Promise<boolean> {
    const data = sessionToRow(session);

    await withRetries("storeSession", () =>
      this.prisma.session.upsert({
        where: { id: session.id },
        update: data,
        create: data,
      })
    );

    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const row = await withRetries("loadSession", () =>
      this.prisma.session.findUnique({ where: { id } })
    );

    return row ? rowToSession(row) : undefined;
  }

  async deleteSession(id: string): Promise<boolean> {
    await withRetries("deleteSession", () =>
      this.prisma.session.deleteMany({ where: { id } })
    );

    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    await withRetries("deleteSessions", () =>
      this.prisma.session.deleteMany({ where: { id: { in: ids } } })
    );

    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const rows = await withRetries("findSessionsByShop", () =>
      this.prisma.session.findMany({
        where: { shop },
        take: 25,
        orderBy: [{ expires: "desc" }],
      })
    );

    return rows.map(rowToSession);
  }
}
