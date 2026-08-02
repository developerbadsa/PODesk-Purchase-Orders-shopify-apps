export type RiskLevel = "Critical" | "Reorder Soon" | "Watch" | "Healthy";

export interface ReorderCalculationInput {
  inventoryQuantity: number;
  unitsSold30Days: number;
  salesWindow: number;
  targetDays: number;
  bufferDays: number;
  supplierLeadTime: number | null;
  hasSupplier?: boolean;
}

export interface ReorderCalculationResult {
  unitsSoldInWindow: number;
  avgDailySales: number;
  daysLeft: number | null;
  risk: RiskLevel;
  riskReason: string;
  suggestedQtyFormula: number | null;
}

/**
 * Calculates stockout risk level based on remaining days of inventory,
 * supplier lead time, and buffer days.
 */
export function getRiskLevel(
  daysLeft: number | null,
  supplierLeadTime: number | null,
  bufferDays: number
): RiskLevel {
  if (daysLeft != null && supplierLeadTime != null) {
    if (daysLeft < supplierLeadTime) return "Critical";
    if (daysLeft < supplierLeadTime + bufferDays) return "Reorder Soon";
    if (daysLeft < supplierLeadTime + bufferDays + 7) return "Watch";
    return "Healthy";
  } else if (daysLeft != null) {
    if (daysLeft < 7) return "Critical";
    if (daysLeft < 14) return "Reorder Soon";
    if (daysLeft < 21) return "Watch";
    return "Healthy";
  }
  return "Healthy";
}

/**
 * Calculates human-readable risk reason text for merchants.
 */
export function getRiskReason(
  inventoryQuantity: number,
  avgDailySales: number,
  daysLeft: number | null,
  supplierLeadTime: number | null,
  bufferDays: number,
  hasSupplier: boolean = true
): string {
  if (!hasSupplier) {
    return "Map supplier first";
  }
  if (inventoryQuantity <= 0) {
    return "Already out of stock";
  }
  if (avgDailySales === 0) {
    return "No recent sales";
  }
  if (daysLeft != null && supplierLeadTime != null) {
    if (daysLeft < supplierLeadTime + bufferDays) {
      return "Stock may run out before supplier lead time + buffer";
    }
    if (daysLeft < supplierLeadTime + bufferDays + 7) {
      return "Stock is low but not urgent";
    }
    return "Stock OK";
  }
  if (daysLeft != null) {
    if (daysLeft < 14) {
      return "Stock may run out before supplier lead time + buffer";
    }
    if (daysLeft < 21) {
      return "Stock is low but not urgent";
    }
    return "Stock OK";
  }
  return "Stock OK";
}

/**
 * Evaluates final suggested quantity, prioritizing active manual override.
 */
export function getFinalSuggestedQuantity(
  suggestedQtyFormula: number | null,
  overrideQuantity: number | null
): number | null {
  if (overrideQuantity !== null && overrideQuantity !== undefined) {
    return overrideQuantity;
  }
  return suggestedQtyFormula;
}

/**
 * Main helper to perform complete reorder calculation for a single variant.
 * Code structure prepared for future out-of-stock days exclusion logic.
 */
export function calculateReorderRecommendation(
  input: ReorderCalculationInput
): ReorderCalculationResult {
  const {
    inventoryQuantity,
    unitsSold30Days,
    salesWindow,
    targetDays,
    bufferDays,
    supplierLeadTime,
    hasSupplier = supplierLeadTime !== null,
  } = input;

  const scaleFactor = salesWindow > 0 ? salesWindow / 30 : 1;
  const unitsSoldInWindow = Math.round(unitsSold30Days * scaleFactor);
  const avgDailySales = salesWindow > 0 ? unitsSoldInWindow / salesWindow : 0;
  const daysLeft = avgDailySales > 0 ? inventoryQuantity / avgDailySales : null;

  const risk = getRiskLevel(daysLeft, supplierLeadTime, bufferDays);
  const riskReason = getRiskReason(
    inventoryQuantity,
    avgDailySales,
    daysLeft,
    supplierLeadTime,
    bufferDays,
    hasSupplier
  );

  let suggestedQtyFormula: number | null = null;
  if (avgDailySales > 0) {
    const needed = targetDays * avgDailySales;
    const deficit = needed - inventoryQuantity;
    suggestedQtyFormula = deficit > 0 ? Math.ceil(deficit) : 0;
  }

  return {
    unitsSoldInWindow,
    avgDailySales: Math.round(avgDailySales * 100) / 100,
    daysLeft: daysLeft != null ? Math.round(daysLeft) : null,
    risk,
    riskReason,
    suggestedQtyFormula,
  };
}
