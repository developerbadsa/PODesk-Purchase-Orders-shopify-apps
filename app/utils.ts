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
