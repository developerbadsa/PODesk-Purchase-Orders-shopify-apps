export function formatCurrency(
  amount: number | null | undefined,
  currencyCode: string = "USD"
): string {
  if (amount == null || !Number.isFinite(amount)) return "-";
  const code = (currencyCode || "USD").trim().toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

export type TargetField =
  | "sku"
  | "supplierName"
  | "supplierSku"
  | "supplierCost"
  | "leadTimeDays"
  | "paymentTerms"
  | "minimumOrder"
  | "notes";

export const TARGET_FIELDS: TargetField[] = [
  "sku",
  "supplierName",
  "supplierSku",
  "supplierCost",
  "leadTimeDays",
  "paymentTerms",
  "minimumOrder",
  "notes",
];

export const FIELD_DEFINITIONS: Record<
  TargetField,
  { label: string; required: boolean; description: string }
> = {
  sku: {
    label: "Shopify SKU",
    required: true,
    description: "Matches synced Shopify variant SKU",
  },
  supplierName: {
    label: "Supplier Name",
    required: true,
    description: "Supplier company name",
  },
  supplierSku: {
    label: "Supplier SKU",
    required: false,
    description: "Supplier's part or order number",
  },
  supplierCost: {
    label: "Supplier Cost",
    required: false,
    description: "Unit cost numeric value",
  },
  leadTimeDays: {
    label: "Lead Time (days)",
    required: false,
    description: "Replenishment lead time in days",
  },
  paymentTerms: {
    label: "Payment Terms",
    required: false,
    description: "e.g. Net 30, Prepaid, COD",
  },
  minimumOrder: {
    label: "Minimum Order",
    required: false,
    description: "Minimum order quantity or value",
  },
  notes: {
    label: "Notes",
    required: false,
    description: "Internal operations notes",
  },
};

export type NormalizedRowData = {
  sku: string;
  supplierName: string;
  supplierSku: string | null;
  supplierCost: number | null;
  leadTimeDays: number | null;
  paymentTerms: string | null;
  minimumOrder: number | null;
  notes: string | null;
};
