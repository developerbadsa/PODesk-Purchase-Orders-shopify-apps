import prisma from "./db.server";

export async function createUniquePoReference(storeId: string): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "");

  for (let attempt = 0; attempt < 5; attempt++) {
    const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const candidate = `PO-${dateStr}-${timeStr}-${randSuffix}`;

    const existing = await prisma.purchaseOrder.findFirst({
      where: { storeId, reference: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  return `PO-${Date.now()}`;
}
