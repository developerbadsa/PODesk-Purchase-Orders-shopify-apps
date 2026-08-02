import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const SALES_WINDOWS = [7, 14, 30, 90] as const;
const DEFAULT_BUFFER_DAYS = 3;
const DEFAULT_TARGET_DAYS = 30;

type ActionData = { ok: boolean; message: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) return { variants: [], suppliers: [], lastSyncAt: null, totalCount: 0, filteredCount: 0, riskCounts: { critical: 0, reorderSoon: 0, watch: 0, healthy: 0 } };

  const url = new URL(request.url);
  const salesWindow = parseInt(url.searchParams.get("window") || "30", 10);
  const bufferDays = parseInt(url.searchParams.get("buffer") || String(DEFAULT_BUFFER_DAYS), 10);
  const targetDays = parseInt(url.searchParams.get("target") || String(DEFAULT_TARGET_DAYS), 10);
  const filterSupplier = url.searchParams.get("supplier") || "";
  const filterRisk = url.searchParams.get("risk") || "";

  // Get all variants with their mappings
  const variants = await prisma.shopifyVariant.findMany({
    where: { storeId: store.id, tracked: true },
    include: {
      product: true,
      supplierMappings: {
        where: { isPrimary: true },
        include: { supplier: true },
        take: 1,
      },
    },
    orderBy: [{ daysUntilStockout: "asc" }, { unitsSold30Days: "desc" }],
  });

  const suppliers = await prisma.supplier.findMany({
    where: { storeId: store.id, isArchived: false },
    orderBy: { name: "asc" },
  });

  // Calculate reorder metrics per variant
  const reorderData = variants.map((v) => {
    const primaryMapping = v.supplierMappings[0] ?? null;
    const supplierName = primaryMapping?.supplier.name ?? null;
    const supplierId = primaryMapping?.supplierId ?? null;
    const supplierLeadTime = primaryMapping?.supplierLeadTimeDays ?? primaryMapping?.supplier.leadTimeDays ?? null;

    // Recalculate based on selected sales window
    const scaleFactor = salesWindow / 30;
    const unitsSoldInWindow = Math.round(v.unitsSold30Days * scaleFactor);
    const avgDailySales = salesWindow > 0 ? unitsSoldInWindow / salesWindow : 0;
    const daysLeft = avgDailySales > 0 ? v.inventoryQuantity / avgDailySales : null;

    // Risk classification
    let risk: "Critical" | "Reorder Soon" | "Watch" | "Healthy" = "Healthy";
    if (daysLeft != null && supplierLeadTime != null) {
      if (daysLeft < supplierLeadTime) risk = "Critical";
      else if (daysLeft < supplierLeadTime + bufferDays) risk = "Reorder Soon";
      else if (daysLeft < supplierLeadTime + bufferDays + 7) risk = "Watch";
    } else if (daysLeft != null) {
      if (daysLeft < 7) risk = "Critical";
      else if (daysLeft < 14) risk = "Reorder Soon";
      else if (daysLeft < 21) risk = "Watch";
    }

    // Suggested reorder quantity
    let suggestedQty: number | null = null;
    if (avgDailySales > 0) {
      const needed = targetDays * avgDailySales;
      const deficit = needed - v.inventoryQuantity;
      suggestedQty = deficit > 0 ? Math.ceil(deficit) : 0;
    }

    return {
      id: v.id,
      productTitle: v.product.title,
      variantTitle: v.title,
      sku: v.sku,
      inventoryQuantity: v.inventoryQuantity,
      unitsSoldInWindow: unitsSoldInWindow,
      avgDailySales: Math.round(avgDailySales * 100) / 100,
      daysLeft: daysLeft != null ? Math.round(daysLeft) : null,
      supplierName,
      supplierId,
      supplierLeadTime,
      risk,
      suggestedQty,
    };
  });

  // Apply filters
  let filtered = reorderData;
  if (filterSupplier) {
    filtered = filtered.filter((v) => v.supplierId === filterSupplier);
  }
  if (filterRisk) {
    filtered = filtered.filter((v) => v.risk === filterRisk);
  }

  return {
    variants: filtered,
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
    lastSyncAt: store.lastSyncAt?.toISOString() ?? null,
    totalCount: reorderData.length,
    filteredCount: filtered.length,
    riskCounts: {
      critical: reorderData.filter((v) => v.risk === "Critical").length,
      reorderSoon: reorderData.filter((v) => v.risk === "Reorder Soon").length,
      watch: reorderData.filter((v) => v.risk === "Watch").length,
      healthy: reorderData.filter((v) => v.risk === "Healthy").length,
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) return { ok: false, message: "Store not found. Open the dashboard first." } satisfies ActionData;

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "create-reorder-po") {
    const variantId = String(formData.get("variantId") || "").trim();
    const supplierId = String(formData.get("supplierId") || "").trim();
    const quantity = numberFromForm(formData.get("quantity"), 0);

    if (!variantId || !supplierId || quantity <= 0) {
      return { ok: false, message: "Variant, supplier, and quantity are required." } satisfies ActionData;
    }

    const mapping = await prisma.supplierVariantMapping.findFirst({
      where: { storeId: store.id, variantId, supplierId },
      include: { supplier: true, variant: true },
    });
    if (!mapping || mapping.supplier.isArchived) {
      return { ok: false, message: "Active supplier mapping not found for this SKU." } satisfies ActionData;
    }

    const expectedArrival = new Date();
    const leadTime = mapping.supplierLeadTimeDays ?? mapping.supplier.leadTimeDays;
    expectedArrival.setDate(expectedArrival.getDate() + leadTime);

    const reference = `PO-${Date.now()}`;
    await prisma.purchaseOrder.create({
      data: {
        storeId: store.id,
        supplierId,
        reference,
        expectedArrival,
        notes: "Created from reorder planning suggestion.",
        lines: {
          create: {
            variantId,
            quantity,
            unitCost: mapping.supplierCost ?? mapping.variant.unitCostAmount,
          },
        },
      },
    });

    return { ok: true, message: `Draft purchase order ${reference} created.` } satisfies ActionData;
  }

  return { ok: false, message: "Unknown action." } satisfies ActionData;
};

export default function ReorderPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";

  const currentWindow = searchParams.get("window") || "30";
  const currentBuffer = searchParams.get("buffer") || String(DEFAULT_BUFFER_DAYS);
  const currentTarget = searchParams.get("target") || String(DEFAULT_TARGET_DAYS);
  const currentSupplier = searchParams.get("supplier") || "";
  const currentRisk = searchParams.get("risk") || "";

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  return (
    <s-page heading="Reorder Planning">
      {actionData?.message ? (
        <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
      ) : null}

      <s-section heading="Risk summary">
        <div style={metricGridStyle}>
          <div style={riskMetric("#d72c0d")}>
            <div style={metricValueStyle}>{data.riskCounts.critical}</div>
            <div style={mutedStyle}>Critical</div>
          </div>
          <div style={riskMetric("#b98900")}>
            <div style={metricValueStyle}>{data.riskCounts.reorderSoon}</div>
            <div style={mutedStyle}>Reorder Soon</div>
          </div>
          <div style={riskMetric("#637381")}>
            <div style={metricValueStyle}>{data.riskCounts.watch}</div>
            <div style={mutedStyle}>Watch</div>
          </div>
          <div style={riskMetric("#008060")}>
            <div style={metricValueStyle}>{data.riskCounts.healthy}</div>
            <div style={mutedStyle}>Healthy</div>
          </div>
        </div>
        <s-paragraph>
          Last sync: {data.lastSyncAt ? formatDateTime(data.lastSyncAt) : "Never synced"}
        </s-paragraph>
      </s-section>

      <s-section heading="Filters">
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "end" }}>
          <label style={fieldLabelStyle}>
            Sales window
            <select
              value={currentWindow}
              onChange={(e) => updateFilter("window", e.target.value)}
              style={inputStyle}
            >
              {SALES_WINDOWS.map((w) => (
                <option key={w} value={String(w)}>{w} days</option>
              ))}
            </select>
          </label>
          <label style={fieldLabelStyle}>
            Buffer days
            <input
              type="number"
              value={currentBuffer}
              min="0"
              onChange={(e) => updateFilter("buffer", e.target.value)}
              style={{ ...inputStyle, width: "80px" }}
            />
          </label>
          <label style={fieldLabelStyle}>
            Target stock days
            <input
              type="number"
              value={currentTarget}
              min="1"
              onChange={(e) => updateFilter("target", e.target.value)}
              style={{ ...inputStyle, width: "80px" }}
            />
          </label>
          <label style={fieldLabelStyle}>
            Supplier
            <select
              value={currentSupplier}
              onChange={(e) => updateFilter("supplier", e.target.value)}
              style={inputStyle}
            >
              <option value="">All suppliers</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label style={fieldLabelStyle}>
            Risk
            <select
              value={currentRisk}
              onChange={(e) => updateFilter("risk", e.target.value)}
              style={inputStyle}
            >
              <option value="">All</option>
              <option value="Critical">Critical</option>
              <option value="Reorder Soon">Reorder Soon</option>
              <option value="Watch">Watch</option>
              <option value="Healthy">Healthy</option>
            </select>
          </label>
        </div>
        <div style={{ ...mutedStyle, marginTop: "8px" }}>
          Showing {data.filteredCount} of {data.totalCount} tracked variants
        </div>
      </s-section>

      <s-section heading="Reorder table">
        {data.variants.length === 0 ? (
          <s-paragraph>No variants match the current filters.</s-paragraph>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Stock</th>
                  <th style={thStyle}>Sold ({currentWindow}d)</th>
                  <th style={thStyle}>Avg/day</th>
                  <th style={thStyle}>Days left</th>
                  <th style={thStyle}>Supplier</th>
                  <th style={thStyle}>Lead</th>
                  <th style={thStyle}>Risk</th>
                  <th style={thStyle}>Suggested qty</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.variants.map((v) => (
                  <tr key={v.id}>
                    <td style={tdStyle}>
                      {v.productTitle}
                      <div style={mutedStyle}>{v.variantTitle}</div>
                    </td>
                    <td style={tdStyle}>{v.sku || "-"}</td>
                    <td style={tdStyle}>{v.inventoryQuantity}</td>
                    <td style={tdStyle}>{v.unitsSoldInWindow}</td>
                    <td style={tdStyle}>{v.avgDailySales}</td>
                    <td style={tdStyle}>{v.daysLeft != null ? v.daysLeft : "-"}</td>
                    <td style={tdStyle}>
                      {v.supplierName ? (
                        <a href={`/app/suppliers/${v.supplierId}`} style={linkStyle}>{v.supplierName}</a>
                      ) : (
                        <span style={mutedStyle}>Unmapped</span>
                      )}
                    </td>
                    <td style={tdStyle}>{v.supplierLeadTime != null ? `${v.supplierLeadTime}d` : "-"}</td>
                    <td style={tdStyle}>
                      <span style={riskBadge(v.risk)}>{v.risk}</span>
                    </td>
                    <td style={tdStyle}>{v.suggestedQty != null ? v.suggestedQty : "-"}</td>
                    <td style={tdStyle}>
                      {v.supplierId && v.suggestedQty && v.suggestedQty > 0 ? (
                        <Form method="post">
                          <input type="hidden" name="intent" value="create-reorder-po" />
                          <input type="hidden" name="variantId" value={v.id} />
                          <input type="hidden" name="supplierId" value={v.supplierId} />
                          <input type="hidden" name="quantity" value={v.suggestedQty} />
                          <button type="submit" disabled={isSubmitting} style={smallBtnStyle}>
                            Create draft PO
                          </button>
                        </Form>
                      ) : (
                        <span style={mutedStyle}>Map supplier first</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </s-section>
    </s-page>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function numberFromForm(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function riskBadge(risk: string) {
  const colors: Record<string, { bg: string; color: string }> = {
    Critical: { bg: "#fff4f4", color: "#d72c0d" },
    "Reorder Soon": { bg: "#fff7ed", color: "#b98900" },
    Watch: { bg: "#f4f6f8", color: "#637381" },
    Healthy: { bg: "#effaf5", color: "#008060" },
  };
  const c = colors[risk] ?? { bg: "#f4f6f8", color: "#637381" };
  return { background: c.bg, color: c.color, padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", display: "inline-block" } as const;
}

// Styles
const metricGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", marginBottom: "8px" } as const;
const riskMetric = (borderColor: string) => ({ border: `2px solid ${borderColor}`, borderRadius: "8px", padding: "14px", background: "#fff" }) as const;
const metricValueStyle = { fontSize: "24px", fontWeight: 700, color: "#202223" } as const;
const mutedStyle = { color: "#6d7175", fontSize: "13px", marginTop: "4px" } as const;
const fieldLabelStyle = { display: "grid", gap: "6px", color: "#202223", fontSize: "13px", fontWeight: 600 } as const;
const inputStyle = { border: "1px solid #c9cccf", borderRadius: "6px", padding: "9px 10px", fontSize: "14px", width: "100%" } as const;
const linkStyle = { color: "#2c6ecb", textDecoration: "none" } as const;
const smallBtnStyle = { border: "1px solid #c9cccf", borderRadius: "4px", padding: "4px 10px", background: "#fff", cursor: "pointer", fontSize: "12px", whiteSpace: "nowrap" } as const;
const tableWrapStyle = { overflowX: "auto" } as const;
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "14px" } as const;
const thStyle = { textAlign: "left", borderBottom: "1px solid #dfe3e8", padding: "10px 8px", whiteSpace: "nowrap" } as const;
const tdStyle = { borderBottom: "1px solid #f1f2f3", padding: "10px 8px", verticalAlign: "top" } as const;
const noticeStyle = (ok: boolean) => ({ border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`, background: ok ? "#effaf5" : "#fff4f4", borderRadius: "8px", marginTop: "12px", marginBottom: "12px", padding: "10px 12px", color: ok ? "#0f5132" : "#8a1f11" }) as const;

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
