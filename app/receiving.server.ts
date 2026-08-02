export type LineReceivingCalculation = {
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  receivingStatus: "NOT_RECEIVED" | "PARTIAL" | "RECEIVED";
};

export type PoReceivingSummary = {
  totalOrderedQuantity: number;
  totalReceivedQuantity: number;
  totalRemainingQuantity: number;
  receiveProgressPercent: number;
  canReceive: boolean;
};

export const RECEIVABLE_STATUSES = [
  "SENT",
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "DELAYED",
] as const;

export function canReceivePo(status: string): boolean {
  return RECEIVABLE_STATUSES.includes(status as (typeof RECEIVABLE_STATUSES)[number]);
}

export function calculateLineReceiving(line: {
  quantity: number;
  receiptLines?: Array<{ quantityReceived: number }>;
}): LineReceivingCalculation {
  const orderedQuantity = Math.max(0, line.quantity);
  const receivedQuantity = (line.receiptLines || []).reduce(
    (sum, rl) => sum + Math.max(0, rl.quantityReceived),
    0,
  );
  const remainingQuantity = Math.max(0, orderedQuantity - receivedQuantity);

  let receivingStatus: "NOT_RECEIVED" | "PARTIAL" | "RECEIVED" = "NOT_RECEIVED";
  if (receivedQuantity > 0) {
    receivingStatus = receivedQuantity >= orderedQuantity ? "RECEIVED" : "PARTIAL";
  }

  return {
    orderedQuantity,
    receivedQuantity,
    remainingQuantity,
    receivingStatus,
  };
}

export function getPoReceivingSummary(
  lines: Array<{ quantity: number; receiptLines?: Array<{ quantityReceived: number }> }>,
  status: string = "DRAFT",
): PoReceivingSummary {
  let totalOrderedQuantity = 0;
  let totalReceivedQuantity = 0;
  let totalRemainingQuantity = 0;

  for (const line of lines) {
    const calc = calculateLineReceiving(line);
    totalOrderedQuantity += calc.orderedQuantity;
    totalReceivedQuantity += calc.receivedQuantity;
    totalRemainingQuantity += calc.remainingQuantity;
  }

  const receiveProgressPercent =
    totalOrderedQuantity > 0
      ? Math.min(100, Math.round((totalReceivedQuantity / totalOrderedQuantity) * 100))
      : 0;

  const canReceive = canReceivePo(status);

  return {
    totalOrderedQuantity,
    totalReceivedQuantity,
    totalRemainingQuantity,
    receiveProgressPercent,
    canReceive,
  };
}
