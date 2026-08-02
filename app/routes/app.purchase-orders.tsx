import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

type ActionData = { ok: boolean; message: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) return { purchaseOrders: [], suppliers: [], variants: [], mappings: [] };

  const [purchaseOrders, suppliers, variants, mappings] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { storeId: store.id },
      include: {
        supplier: true,
        lines: { include: { variant: { include: { product: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.supplier.findMany({
      where: { storeId: store.id, isArchived: false },
      orderBy: { name: "asc" },
    }),
    prisma.shopifyVariant.findMany({
      where: { storeId: store.id },
      include: { product: true },
      orderBy: [{ product: { title: "asc" } }, { title: "asc" }],
    }),
    prisma.supplierVariantMapping.findMany({
      where: { storeId: store.id },
      select: { supplierId: true, variantId: true, supplierCost: true, supplierSku: true },
    }),
  ]);

  return {
    purchaseOrders: purchaseOrders.map((po) => ({
      id: po.id,
      reference: po.reference,
      supplierName: po.supplier.name,
      status: po.status,
      lineCount: po.lines.length,
      totalCost: po.lines.reduce((sum, l) => sum + (l.unitCost ?? 0) * l.quantity, 0),
      expectedArrival: po.expectedArrival?.toISOString() ?? null,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
    })),
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
  const { session } = await authenticate.admin(request);
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
      const quantity = parseInt(String(lineQuantities[i] || "0"), 10);
      const costStr = String(lineUnitCosts[i] || "").trim();
      const unitCost = costStr ? Number(costStr) : null;

      if (variantId && validVariantSet.has(variantId) && quantity > 0) {
        lines.push({ variantId, quantity, unitCost: unitCost && Number.isFinite(unitCost) ? unitCost : null });
      }
    }

    if (lines.length === 0) {
      return { ok: false, message: "At least one valid line item is required." } satisfies ActionData;
    }

    const reference = `PO-${Date.now()}`;
    await prisma.purchaseOrder.create({
      data: {
        storeId: store.id,
        supplierId: supplier.id,
        reference,
        expectedArrival: dateFromForm(formData.get("expectedArrival")),
        notes: optionalString(formData.get("notes")),
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
  const { purchaseOrders, suppliers, variants, mappings } = useLoaderData<typeof loader>();
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
          <s-paragraph>
            <a href="/app/suppliers" style={linkStyle}>Add a supplier</a> before creating a purchase order.
          </s-paragraph>
        ) : variants.length === 0 ? (
          <s-paragraph>
            <a href="/app" style={linkStyle}>Sync inventory</a> first to create purchase orders from real SKUs.
          </s-paragraph>
        ) : (
          <Form method="post" id="create-po-form">
            <input type="hidden" name="intent" value="create-po" />
            <div style={formGridStyle}>
              <label style={fieldLabelStyle}>
                Supplier
                <select
                  name="supplierId"
                  required
                  style={inputStyle}
                  value={selectedSupplierId}
                  onChange={(e) => handleSupplierChange(e.target.value)}
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <Field label="Expected arrival" name="expectedArrival" type="date" />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>Line items</div>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "8px", marginBottom: "6px" }}>
                  <select
                    name="lineVariantId"
                    style={inputStyle}
                    value={lineVariants[i] ?? ""}
                    onChange={(e) => handleVariantChange(i, e.target.value)}
                  >
                    <option value="">- select variant -</option>
                    {variants.map((v) => {
                      const isMapped = mappings.some(
                        (m) => m.supplierId === selectedSupplierId && m.variantId === v.id
                      );
                      return (
                        <option key={v.id} value={v.id}>
                          {v.productTitle} - {v.variantTitle} {v.sku ? `(${v.sku})` : ""}
                          {isMapped ? " ★ mapped" : ""}
                        </option>
                      );
                    })}
                  </select>
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
              <div style={mutedStyle}>Fill at least one line. Mapped SKUs show ★ and prefill unit cost automatically.</div>
            </div>

            <label style={fieldLabelStyle}>
              Notes
              <textarea name="notes" rows={2} style={textareaStyle} />
            </label>
            <button type="submit" disabled={isSubmitting} style={buttonStyle}>
              Create PO
            </button>
          </Form>
        )}
      </s-section>

      <s-section heading={`All purchase orders (${purchaseOrders.length})`}>
        {purchaseOrders.length === 0 ? (
          <s-paragraph>No purchase orders yet.</s-paragraph>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Reference</th>
                  <th style={thStyle}>Supplier</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Lines</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Expected</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Updated</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td style={tdStyle}>
                      <a href={`/app/purchase-orders/${po.id}`} style={linkStyle}>{po.reference}</a>
                    </td>
                    <td style={tdStyle}>{po.supplierName}</td>
                    <td style={tdStyle}>
                      <span style={statusBadge(po.status)}>{po.status.replaceAll("_", " ")}</span>
                    </td>
                    <td style={tdStyle}>{po.lineCount}</td>
                    <td style={tdStyle}>{po.totalCost > 0 ? `$${po.totalCost.toFixed(2)}` : "-"}</td>
                    <td style={tdStyle}>{po.expectedArrival ? formatDate(po.expectedArrival) : "-"}</td>
                    <td style={tdStyle}>{formatDate(po.createdAt)}</td>
                    <td style={tdStyle}>{formatDate(po.updatedAt)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <a href={`/app/purchase-orders/${po.id}`} style={linkStyle}>View</a>
                        <a href={`/app/purchase-orders/${po.id}/print`} style={linkStyle}>Print</a>
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
  label, name, type = "text", required = false, defaultValue, step,
}: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string; step?: string;
}) {
  return (
    <label style={fieldLabelStyle}>
      {label}
      <input name={name} type={type} required={required} defaultValue={defaultValue} step={step} style={inputStyle} />
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
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "12px" } as const;
const fieldLabelStyle = { display: "grid", gap: "6px", color: "#202223", fontSize: "13px", fontWeight: 600 } as const;
const inputStyle = { border: "1px solid #c9cccf", borderRadius: "6px", padding: "9px 10px", fontSize: "14px", width: "100%" } as const;
const textareaStyle = { ...inputStyle, resize: "vertical" } as const;
const buttonStyle = { border: "0", borderRadius: "6px", padding: "10px 14px", background: "#008060", color: "#fff", fontWeight: 650, cursor: "pointer" } as const;
const linkStyle = { color: "#2c6ecb", textDecoration: "none" } as const;
const mutedStyle = { color: "#6d7175", fontSize: "13px", marginTop: "4px" } as const;
const tableWrapStyle = { overflowX: "auto" } as const;
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "14px" } as const;
const thStyle = { textAlign: "left", borderBottom: "1px solid #dfe3e8", padding: "10px 8px", whiteSpace: "nowrap" } as const;
const tdStyle = { borderBottom: "1px solid #f1f2f3", padding: "10px 8px", verticalAlign: "top" } as const;
const noticeStyle = (ok: boolean) => ({ border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`, background: ok ? "#effaf5" : "#fff4f4", borderRadius: "8px", marginTop: "12px", marginBottom: "12px", padding: "10px 12px", color: ok ? "#0f5132" : "#8a1f11" }) as const;

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
