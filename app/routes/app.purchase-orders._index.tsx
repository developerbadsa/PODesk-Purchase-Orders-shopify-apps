import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../authenticate-admin.server";
import { SearchableSelect } from "../components/SearchableSelect";
import prisma from "../db.server";
import { createUniquePoReference } from "../po.server";
import { formatCurrency } from "../utils";

type ActionData = { ok: boolean; message: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "purchase-orders-loader");
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) return { purchaseOrders: [], suppliers: [], variants: [], mappings: [], currencyCode: "USD" };

  const [settings, purchaseOrders, suppliers, variants, mappings] = await Promise.all([
    prisma.storeSettings.findUnique({ where: { storeId: store.id } }),
    prisma.purchaseOrder.findMany({
      where: { storeId: store.id },
      select: {
        id: true,
        reference: true,
        status: true,
        expectedArrival: true,
        lastSentAt: true,
        sentCount: true,
        createdAt: true,
        updatedAt: true,
        supplier: { select: { name: true } },
        lines: {
          select: {
            quantity: true,
            unitCost: true,
            receiptLines: { select: { quantityReceived: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.supplier.findMany({
      where: { storeId: store.id, isArchived: false },
      orderBy: { name: "asc" },
    }),
    // Only load variants that have at least one supplier mapping —
    // avoids loading thousands of unmapped variants for the PO line item picker.
    prisma.shopifyVariant.findMany({
      where: {
        storeId: store.id,
        supplierMappings: { some: { storeId: store.id } },
      },
      select: {
        id: true,
        title: true,
        sku: true,
        unitCostAmount: true,
        product: { select: { title: true } },
      },
      orderBy: [{ product: { title: "asc" } }, { title: "asc" }],
      take: 1000,
    }),
    prisma.supplierVariantMapping.findMany({
      where: { storeId: store.id },
      select: { supplierId: true, variantId: true, supplierCost: true, supplierSku: true },
      take: 2000,
    }),
  ]);

  const currencyCode = settings?.currencyCode || "USD";

  return {
    currencyCode,
    purchaseOrders: purchaseOrders.map((po) => {
      const totalOrdered = po.lines.reduce((sum, l) => sum + l.quantity, 0);
      const totalReceived = po.lines.reduce(
        (sum, l) => sum + l.receiptLines.reduce((rSum, rl) => rSum + rl.quantityReceived, 0),
        0
      );
      const receiveProgressPercent =
        totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;

      return {
        id: po.id,
        reference: po.reference,
        supplierName: po.supplier.name,
        status: po.status,
        lineCount: po.lines.length,
        totalCost: po.lines.reduce((sum, l) => sum + (l.unitCost ?? 0) * l.quantity, 0),
        totalOrdered,
        totalReceived,
        receiveProgressPercent,
        expectedArrival: po.expectedArrival?.toISOString() ?? null,
        lastSentAt: po.lastSentAt?.toISOString() ?? null,
        sentCount: po.sentCount,
        createdAt: po.createdAt.toISOString(),
        updatedAt: po.updatedAt.toISOString(),
      };
    }),
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
    variants: variants.map((v) => ({
      id: v.id,
      productTitle: v.product.title,
      variantTitle: v.title,
      sku: v.sku,
      unitCostAmount: v.unitCostAmount,
    })),
    mappings: mappings.map((m) => ({
      supplierId: m.supplierId,
      variantId: m.variantId,
      supplierCost: m.supplierCost,
      supplierSku: m.supplierSku,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "purchase-orders-action");
  const store = await prisma.store.upsert({
    where: { shop: session.shop },
    update: {},
    create: { shop: session.shop },
  });
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "create-po") {
    const supplierId = String(formData.get("supplierId") || "").trim();
    if (!supplierId) return { ok: false, message: "Supplier is required." } satisfies ActionData;

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, storeId: store.id, isArchived: false },
    });
    if (!supplier) {
      return { ok: false, message: "Supplier not found or archived." } satisfies ActionData;
    }

    // Collect line items from form
    const lineVariantIds = formData.getAll("lineVariantId").map(String);
    const lineQuantities = formData.getAll("lineQuantity");
    const lineUnitCosts = formData.getAll("lineUnitCost");

    const validVariants = await prisma.shopifyVariant.findMany({
      where: { id: { in: lineVariantIds }, storeId: store.id },
      select: { id: true },
    });
    const validVariantSet = new Set(validVariants.map((v) => v.id));

    const lines: Array<{ variantId: string; quantity: number; unitCost: number | null }> = [];
    for (let i = 0; i < lineVariantIds.length; i++) {
      const variantId = lineVariantIds[i].trim();
      const quantityText = String(lineQuantities[i] || "").trim();
      const costStr = String(lineUnitCosts[i] || "").trim();
      const parsedUnitCost = costStr ? Number(costStr) : null;

      if (!variantId) continue;
      if (!validVariantSet.has(variantId)) continue;

      if (!/^\d+$/.test(quantityText) || Number(quantityText) <= 0) {
        return { ok: false, message: "Line quantity must be a positive whole number." } satisfies ActionData;
      }
      if (costStr && (parsedUnitCost === null || !Number.isFinite(parsedUnitCost) || parsedUnitCost < 0)) {
        return { ok: false, message: "Line unit cost must be a valid non-negative number." } satisfies ActionData;
      }

      const quantity = Number(quantityText);
      if (quantity > 0) {
        lines.push({ variantId, quantity, unitCost: parsedUnitCost });
      }
    }

    if (lines.length === 0) {
      return { ok: false, message: "At least one valid line item is required." } satisfies ActionData;
    }

    const settings = await prisma.storeSettings.findUnique({
      where: { storeId: store.id },
    });

    let notes = optionalString(formData.get("notes"));
    if (!notes && settings?.defaultPoNotes) {
      notes = settings.defaultPoNotes;
    }

    const reference = await createUniquePoReference(store.id);
    await prisma.purchaseOrder.create({
      data: {
        storeId: store.id,
        supplierId: supplier.id,
        reference,
        expectedArrival: dateFromForm(formData.get("expectedArrival")),
        notes,
        lines: {
          create: lines.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        },
      },
    });
    return { ok: true, message: `Purchase order ${reference} created with ${lines.length} line(s).` } satisfies ActionData;
  }

  return { ok: false, message: "Unknown action." } satisfies ActionData;
};

export default function PurchaseOrdersPage() {
  const { currencyCode, purchaseOrders, suppliers, variants, mappings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [lineVariants, setLineVariants] = useState<Record<number, string>>({});
  const [lineCosts, setLineCosts] = useState<Record<number, string>>({});

  function getVariantCost(supplierId: string, variantId: string): string | null {
    if (!variantId) return null;
    const mapping = mappings.find(
      (m) => m.supplierId === supplierId && m.variantId === variantId
    );
    const variant = variants.find((v) => v.id === variantId);
    const cost = mapping?.supplierCost ?? variant?.unitCostAmount ?? null;
    return cost != null ? String(cost) : null;
  }

  function handleSupplierChange(newSupplierId: string) {
    setSelectedSupplierId(newSupplierId);
    const nextCosts: Record<number, string> = {};
    for (const [indexStr, variantId] of Object.entries(lineVariants)) {
      const idx = Number(indexStr);
      if (variantId) {
        const cost = getVariantCost(newSupplierId, variantId);
        nextCosts[idx] = cost ?? "";
      }
    }
    setLineCosts(nextCosts);
  }

  function handleVariantChange(index: number, variantId: string) {
    setLineVariants((prev) => ({ ...prev, [index]: variantId }));
    if (!variantId) {
      setLineCosts((prev) => ({ ...prev, [index]: "" }));
      return;
    }
    const cost = getVariantCost(selectedSupplierId, variantId);
    setLineCosts((prev) => ({ ...prev, [index]: cost ?? "" }));
  }

  return (
    <s-page heading="Purchase Orders">
      {actionData?.message ? (
        <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
      ) : null}

      <s-section heading="Create purchase order">
        {suppliers.length === 0 ? (
          <div style={{ padding: "20px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px" }}>
            <div style={{ fontWeight: 650, fontSize: "15px", marginBottom: "6px", color: "#202223" }}>No suppliers found</div>
            <p style={{ margin: "0 0 14px", color: "#6d7175", fontSize: "13px" }}>
              Add a supplier first before creating a purchase order.
            </p>
            <Link to="/app/suppliers" style={buttonStyle}>Add Supplier</Link>
          </div>
        ) : variants.length === 0 ? (
          <div style={{ padding: "20px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px" }}>
            <div style={{ fontWeight: 650, fontSize: "15px", marginBottom: "6px", color: "#202223" }}>No Shopify variants synced yet</div>
            <p style={{ margin: "0 0 14px", color: "#6d7175", fontSize: "13px" }}>
              Sync inventory first to create purchase orders from real SKUs.
            </p>
            <Link to="/app" style={buttonStyle}>Sync Inventory</Link>
          </div>
        ) : (
          <div style={formCardStyle}>
            <Form method="post" id="create-po-form">
              <input type="hidden" name="intent" value="create-po" />
              <div style={formGridStyle}>
                <label style={fieldLabelStyle}>
                  <span>Supplier <span style={{ color: "#d72c0d" }}>*</span></span>
                  <div style={{ zIndex: 100 }}>
                    <SearchableSelect
                      name="supplierId"
                      required
                      placeholder="Select supplier..."
                      value={selectedSupplierId}
                      onChange={handleSupplierChange}
                      options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  </div>
                </label>
                <Field label="Expected arrival date" name="expectedArrival" type="date" />
              </div>

              <div style={{ margin: "20px 0" }}>
                <div style={{ fontWeight: 650, fontSize: "14px", color: "#202223", marginBottom: "10px" }}>
                  Line items
                </div>
                
                {/* Line items table header */}
                <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr", gap: "12px", marginBottom: "8px", padding: "0 4px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 650, color: "#5c5f62", textTransform: "uppercase" }}>Variant / Product SKU</div>
                  <div style={{ fontSize: "12px", fontWeight: 650, color: "#5c5f62", textTransform: "uppercase" }}>Quantity</div>
                  <div style={{ fontSize: "12px", fontWeight: 650, color: "#5c5f62", textTransform: "uppercase" }}>Unit Cost ($)</div>
                </div>

                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr", gap: "12px", marginBottom: "10px" }}>
                    <div style={{ zIndex: 90 - i }}>
                      <SearchableSelect
                        name="lineVariantId"
                        placeholder="- select variant -"
                        value={lineVariants[i] || ""}
                        onChange={(val) => handleVariantChange(i, val)}
                        options={variants.map((v) => {
                          const isMapped = mappings.some((m) => m.supplierId === selectedSupplierId && m.variantId === v.id);
                          return {
                            value: v.id,
                            label: `${v.productTitle} - ${v.variantTitle} ${v.sku ? `(${v.sku})` : ""}${isMapped ? " [mapped]" : ""}`
                          };
                        })}
                      />
                    </div>
                    <input name="lineQuantity" type="number" placeholder="Qty" min="0" style={inputStyle} />
                    <input
                      name="lineUnitCost"
                      type="number"
                      step="0.01"
                      placeholder="Cost"
                      style={inputStyle}
                      value={lineCosts[i] ?? ""}
                      onChange={(e) => setLineCosts((prev) => ({ ...prev, [i]: e.target.value }))}
                    />
                  </div>
                ))}
                <div style={mutedStyle}>
                  Fill at least one line item. Mapped SKUs show <span style={{ color: "#008060", fontWeight: 600 }}>[mapped]</span> and prefill unit cost automatically.
                </div>
              </div>

              <label style={fieldLabelStyle}>
                <span>Notes / Instructions (Optional)</span>
                <textarea name="notes" rows={2} placeholder="Add special instructions for supplier..." style={textareaStyle} />
              </label>

              <div style={{ marginTop: "18px" }}>
                <button type="submit" disabled={isSubmitting} style={buttonStyle}>
                  {isSubmitting ? "Creating PO..." : "Create purchase order"}
                </button>
              </div>
            </Form>
          </div>
        )}
      </s-section>

      <s-section heading={`All purchase orders (${purchaseOrders.length})`}>
        {purchaseOrders.length === 0 ? (
          <div style={{ padding: "20px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px" }}>
            <div style={{ fontWeight: 650, fontSize: "15px", marginBottom: "6px", color: "#202223" }}>No purchase orders created yet</div>
            <p style={{ margin: "0 0 14px", color: "#6d7175", fontSize: "13px" }}>
              Create your first draft purchase order using the form above or review automated reorder suggestions based on your sales velocity.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <Link to="/app/reorder" style={buttonStyle}>Open Reorder Planning</Link>
              <Link to="/app/mappings" style={secondaryButtonStyle}>Map Suppliers & SKUs</Link>
            </div>
          </div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Reference</th>
                  <th style={thStyle}>Supplier</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Lines</th>
                  <th style={thStyle}>Receiving</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Expected</th>
                  <th style={thStyle}>Sent</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Updated</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td style={tdStyle}>
                      <Link to={`/app/purchase-orders/${po.id}`} style={linkStyle}>{po.reference}</Link>
                    </td>
                    <td style={tdStyle}>{po.supplierName}</td>
                    <td style={tdStyle}>
                      <span style={statusBadge(po.status)}>{po.status.replaceAll("_", " ")}</span>
                    </td>
                    <td style={tdStyle}>{po.lineCount}</td>
                    <td style={tdStyle}>
                      {po.totalOrdered > 0
                        ? `${po.totalReceived} / ${po.totalOrdered} (${po.receiveProgressPercent}%)`
                        : "-"}
                    </td>
                    <td style={tdStyle}>{po.totalCost > 0 ? formatCurrency(po.totalCost, currencyCode) : "-"}</td>
                    <td style={tdStyle}>{po.expectedArrival ? formatDate(po.expectedArrival) : "-"}</td>
                    <td style={tdStyle}>{po.lastSentAt ? `${formatDate(po.lastSentAt)} (${po.sentCount}x)` : "-"}</td>
                    <td style={tdStyle}>{formatDate(po.createdAt)}</td>
                    <td style={tdStyle}>{formatDate(po.updatedAt)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <Link to={`/app/purchase-orders/${po.id}`} style={linkStyle}>View</Link>
                        <Link to={`/app/purchase-orders/${po.id}/print`} style={linkStyle}>Print</Link>
                      </div>
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

function Field({
  label, name, type = "text", required = false, defaultValue, step, placeholder,
}: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string; step?: string; placeholder?: string;
}) {
  return (
    <label style={fieldLabelStyle}>
      <span>{label} {required ? <span style={{ color: "#d72c0d" }}>*</span> : null}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue} step={step} placeholder={placeholder} style={inputStyle} />
    </label>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s.length > 0 ? s : null;
}

function dateFromForm(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s ? new Date(`${s}T00:00:00.000Z`) : null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function statusBadge(status: string) {
  const colors: Record<string, { bg: string; color: string }> = {
    DRAFT: { bg: "#f4f6f8", color: "#6d7175" },
    SENT: { bg: "#eaf5fe", color: "#1f5199" },
    CONFIRMED: { bg: "#effaf5", color: "#0f5132" },
    PARTIALLY_RECEIVED: { bg: "#fff7ed", color: "#8a5a00" },
    RECEIVED: { bg: "#effaf5", color: "#0f5132" },
    DELAYED: { bg: "#fff4f4", color: "#8a1f11" },
    CANCELLED: { bg: "#f4f6f8", color: "#6d7175" },
  };
  const c = colors[status] ?? { bg: "#f4f6f8", color: "#6d7175" };
  return {
    background: c.bg,
    color: c.color,
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: 600,
    display: "inline-block",
  } as const;
}

// Styles
const formCardStyle = { background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "10px", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" } as const;
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" } as const;
const fieldLabelStyle = { display: "flex", flexDirection: "column", gap: "6px", color: "#202223", fontSize: "13px", fontWeight: 600 } as const;
const inputStyle = { height: "40px", border: "1px solid #8c9196", borderRadius: "8px", padding: "0 12px", fontSize: "14px", width: "100%", backgroundColor: "#ffffff", outline: "none", boxSizing: "border-box" } as const;
const textareaStyle = { ...inputStyle, height: "auto", minHeight: "72px", padding: "10px 12px", resize: "vertical" } as const;
const buttonStyle = { height: "40px", border: "0", borderRadius: "8px", padding: "0 20px", background: "#008060", color: "#fff", fontWeight: 650, fontSize: "14px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", boxShadow: "0 1px 2px rgba(0,0,0,0.12)" } as const;
const secondaryButtonStyle = { height: "40px", border: "1px solid #c9cccf", borderRadius: "8px", padding: "0 20px", background: "#ffffff", color: "#202223", fontWeight: 600, fontSize: "14px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" } as const;
const linkStyle = { color: "#2c6ecb", textDecoration: "none", fontWeight: 600 } as const;
const mutedStyle = { color: "#6d7175", fontSize: "13px", marginTop: "6px" } as const;
const tableWrapStyle = { overflowX: "auto" } as const;
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "14px" } as const;
const thStyle = { textAlign: "left", borderBottom: "1px solid #dfe3e8", padding: "12px 10px", whiteSpace: "nowrap", color: "#5c5f62", fontSize: "13px", fontWeight: 650 } as const;
const tdStyle = { borderBottom: "1px solid #f1f2f3", padding: "12px 10px", verticalAlign: "middle" } as const;
const noticeStyle = (ok: boolean) => ({ border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`, background: ok ? "#effaf5" : "#fff4f4", borderRadius: "8px", marginTop: "12px", marginBottom: "12px", padding: "12px 16px", color: ok ? "#0f5132" : "#8a1f11", fontWeight: 550 }) as const;


// Shopify requires ErrorBoundary on every route that calls authenticate.admin
// so that thrown 200/401 responses (App Bridge re-auth) are handled correctly.
export function ErrorBoundary() {
  const error = useRouteError();
  const boundaryError = boundary.error(error);
  if (error instanceof Response && (error.status === 200 || error.status === 401)) {
    return boundaryError;
  }
  let msg = "Unknown error";
  let stack = "";
  if (error instanceof Error) {
    msg = error.message;
    stack = error.stack || "";
  } else if (error instanceof Response) {
    msg = `${error.status} ${error.statusText}`;
  } else {
    msg = JSON.stringify(error);
  }
  return (
    <div style={{ padding: "20px", color: "#8a1f11", background: "#fff4f4", margin: "20px", borderRadius: "8px", border: "1px solid #e0b3b2", fontFamily: "monospace", overflowX: "auto" }}>
      <h2 style={{ margin: "0 0 10px 0" }}>Runtime Error</h2>
      <div style={{ fontWeight: "bold", marginBottom: "10px" }}>{msg}</div>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", background: "#f9e5e5", padding: "10px", borderRadius: "4px" }}>
        {stack || JSON.stringify(error, null, 2)}
      </pre>
    </div>
  );
}
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};


