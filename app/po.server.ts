import prisma from "./db.server";

export async function createUniquePoReference(storeId: string): Promise<string> {
  const settings = await prisma.storeSettings.findUnique({
    where: { storeId },
    select: { poNumberPrefix: true },
  });

  let rawPrefix = (settings?.poNumberPrefix || "PO").trim().toUpperCase();
  // Sanitize prefix to safe characters
  rawPrefix = rawPrefix.replace(/[^A-Z0-9_-]/g, "");
  if (!rawPrefix) rawPrefix = "PO";

  const prefix = rawPrefix.endsWith("-") ? rawPrefix : `${rawPrefix}-`;

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");

  for (let attempt = 0; attempt < 5; attempt++) {
    const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const candidate = `${prefix}${dateStr}-${timeStr}-${randSuffix}`;

    const existing = await prisma.purchaseOrder.findFirst({
      where: { storeId, reference: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  return `${prefix}${Date.now()}`;
}
