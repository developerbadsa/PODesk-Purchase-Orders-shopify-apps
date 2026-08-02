import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, redirect } from "react-router";
import type { PurchaseOrderStatus } from "@prisma/client";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { createUniquePoReference } from "../po.server";
import { formatCurrency } from "../utils";

type ActionData = { ok: boolean; message: string };

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["CONFIRMED", "DELAYED", "CANCELLED"],
  CONFIRMED: ["PARTIALLY_RECEIVED", "RECEIVED", "DELAYED", "CANCELLED"],
  PARTIALLY_RECEIVED: ["RECEIVED", "DELAYED"],
  DELAYED: ["CONFIRMED", "RECEIVED", "CANCELLED"],
  RECEIVED: [],
  CANCELLED: [],
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) throw new Response("Store not found", { status: 404 });

  const [settings, po, variants, mappings] = await Promise.all([
    prisma.storeSettings.findUnique({ where: { storeId: store.id } }),
    prisma.purchaseOrder.findFirst({
      where: { id: params.id, storeId: store.id },
      include: {
        supplier: true,
        lines: {
          include: {
            variant: { include: { product: true } },
          },
        },
      },
    }),
    prisma.shopifyVariant.findMany({
      where: { storeId: store.id },
      include: { product: true },
      orderBy: [{ product: { title: "asc" } }, { title: "asc" }],
    }),
    prisma.supplierVariantMapping.findMany({
      where: { storeId: store.id },
      select: { variantId: true, supplierCost: true },
    }),
  ]);

  if (!po) throw new Response("Purchase order not found", { status: 404 });

  const currencyCode = settings?.currencyCode || "USD";

  return {
    currencyCode,
    po: {
      id: po.id,
      reference: po.reference,
      supplierId: po.supplierId,
      supplierName: po.supplier.name,
      status: po.status,
      expectedArrival: po.expectedArrival?.toISOString().slice(0, 10) ?? "",
      notes: po.notes,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
      lines: po.lines.map((l) => ({
        id: l.id,
        variantId: l.variantId,
        productTitle: l.variant.product.title,
        variantTitle: l.variant.title,
        sku: l.variant.sku,
        quantity: l.quantity,
        unitCost: l.unitCost,
        subtotal: (l.unitCost ?? 0) * l.quantity,
      })),
      totalCost: po.lines.reduce((sum, l) => sum + (l.unitCost ?? 0) * l.quantity, 0),
    },
    variants: variants.map((v) => ({
      id: v.id,
      productTitle: v.product.title,
      variantTitle: v.title,
      sku: v.sku,
      unitCostAmount: v.unitCostAmount,
    })),
    mappings: mappings.map((m) => ({
      variantId: m.variantId,
      supplierCost: m.supplierCost,
    })),
    isDraft: po.status === "DRAFT",
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) return { ok: false, message: "Store not found." } satisfies ActionData;

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, storeId: store.id },
  });
  if (!po) return { ok: false, message: "Purchase order not found." } satisfies ActionData;

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "update-status") {
    const nextStatus = String(formData.get("status") || "");
    const allowedNext = ALLOWED_STATUS_TRANSITIONS[po.status] || [];
    if (!allowedNext.includes(nextStatus)) {
      return { ok: false, message: "Invalid status transition." } satisfies ActionData;
    }
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: nextStatus as PurchaseOrderStatus },
    });
    return { ok: true, message: `Status updated to ${nextStatus.replaceAll("_", " ")}.` } satisfies ActionData;
  }

  if (intent === "update-reference" || intent === "update-po") {
    if (po.status !== "DRAFT") {
      return { ok: false, message: "Only draft purchase orders can be edited." } satisfies ActionData;
    }

    const newReference = String(formData.get("reference") || "").trim();
    if (!newReference) {
      return { ok: false, message: "PO reference is required." } satisfies ActionData;
    }

    if (newReference !== po.reference) {
      const existing = await prisma.purchaseOrder.findFirst({
        where: {
          storeId: store.id,
          reference: newReference,
          NOT: { id: po.id },
        },
      });
      if (existing) {
        return {
          ok: false,
          message: "Another purchase order already uses this reference.",
        } satisfies ActionData;
      }
    }

    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        reference: newReference,
        expectedArrival: dateFromForm(formData.get("expectedArrival")),
        notes: optionalString(formData.get("notes")),
      },
    });
    return { ok: true, message: intent === "update-reference" ? "PO reference updated." : "Purchase order updated." } satisfies ActionData;
  }

  if (intent === "add-line") {
    if (po.status !== "DRAFT") {
      return { ok: false, message: "Lines can only be added to draft purchase orders." } satisfies ActionData;
    }
    const variantId = String(formData.get("variantId") || "").trim();
    const quantity = parseInt(String(formData.get("quantity") || "0"), 10);
    const costStr = String(formData.get("unitCost") || "").trim();
    const unitCost = costStr ? Number(costStr) : null;

    if (!variantId || quantity <= 0) {
      return { ok: false, message: "Variant and quantity are required." } satisfies ActionData;
    }

    const variant = await prisma.shopifyVariant.findFirst({
      where: { id: variantId, storeId: store.id },
    });
    if (!variant) {
      return { ok: false, message: "Variant not found for this store." } satisfies ActionData;
    }

    await prisma.purchaseOrderLine.create({
      data: {
        purchaseOrderId: po.id,
        variantId: variant.id,
        quantity,
        unitCost: unitCost != null && Number.isFinite(unitCost) ? unitCost : null,
      },
    });
    return { ok: true, message: "Line item added." } satisfies ActionData;
  }

  if (intent === "remove-line") {
    if (po.status !== "DRAFT") {
      return { ok: false, message: "Lines can only be removed from draft purchase orders." } satisfies ActionData;
    }
    const lineId = String(formData.get("lineId") || "");
    const line = await prisma.purchaseOrderLine.findFirst({
      where: { id: lineId, purchaseOrderId: po.id },
    });
    if (!line) {
      return { ok: false, message: "Line item not found." } satisfies ActionData;
    }
    await prisma.purchaseOrderLine.delete({ where: { id: line.id } });
    return { ok: true, message: "Line item removed." } satisfies ActionData;
  }

  if (intent === "duplicate") {
    const original = await prisma.purchaseOrder.findFirst({
      where: { id: po.id, storeId: store.id },
      include: { lines: true },
    });
    if (!original) return { ok: false, message: "PO not found." } satisfies ActionData;

    const reference = await createUniquePoReference(store.id);
    const newPo = await prisma.purchaseOrder.create({
      data: {
        storeId: store.id,
        supplierId: original.supplierId,
        reference,
        notes: original.notes,
        lines: {
          create: original.lines.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        },
      },
    });
    return redirect(`/app/purchase-orders/${newPo.id}`);
  }

  if (intent === "delete") {
    if (po.status !== "DRAFT") {
      return { ok: false, message: "Only draft purchase orders can be deleted." } satisfies ActionData;
    }
    await prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: po.id } });
    await prisma.purchaseOrder.delete({ where: { id: po.id } });
    return redirect("/app/purchase-orders");
  }

  return { ok: false, message: "Unknown action." } satisfies ActionData;
};

export default function PurchaseOrderDetailPage() {
  const { currencyCode, po, variants, mappings, isDraft } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [unitCost, setUnitCost] = useState("");

  function handleVariantChange(variantId: string) {
    if (!variantId) return;
    const mapping = mappings.find((m) => m.variantId === variantId);
    const variant = variants.find((v) => v.id === variantId);
    const cost = mapping?.supplierCost ?? variant?.unitCostAmount ?? null;
    if (cost != null) {
      setUnitCost(String(cost));
    }
  }

  const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[po.status] || [];
  const isTerminalState = allowedTransitions.length === 0;

  return (
    <s-page heading={po.reference}>
      {actionData?.message ? (
        <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
      ) : null}

      <s-section heading="Details">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div style={metaGridStyle}>
            <div><strong>Supplier:</strong> <a href={`/app/suppliers/${po.supplierId}`} style={linkStyle}>{po.supplierName}</a></div>
            <div><strong>Status:</strong> <span style={statusBadge(po.status)}>{po.status.replaceAll("_", " ")}</span></div>
            <div><strong>Total cost:</strong> {po.totalCost > 0 ? formatCurrency(po.totalCost, currencyCode) : "-"}</div>
            <div><strong>Currency:</strong> {currencyCode}</div>
            <div><strong>Created:</strong> {formatDate(po.createdAt)}</div>
            <div><strong>Last updated:</strong> {formatDate(po.updatedAt)}</div>
          </div>
          <a
            href={`/app/purchase-orders/${po.id}/print`}
            style={printBtnLinkStyle}
          >
            Print PO
          </a>
        </div>
      </s-section>

      <s-section heading="Status">
        {isTerminalState ? (
          <div style={mutedStyle}>No further status changes available for {po.status.replaceAll("_", " ")} purchase orders.</div>
        ) : (
          <Form method="post" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input type="hidden" name="intent" value="update-status" />
            {allowedTransitions.map((s) => (
              <button
                key={s}
                type="submit"
                name="status"
                value={s}
                disabled={isSubmitting}
                style={statusBtn}
              >
                Move to {s.replaceAll("_", " ")}
              </button>
            ))}
          </Form>
        )}
      </s-section>

      <s-section heading={`Line items (${po.lines.length})`}>
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Qty</th>
                <th style={thStyle}>Unit cost</th>
                <th style={thStyle}>Subtotal</th>
                {isDraft && <th style={thStyle}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line) => (
                <tr key={line.id}>
                  <td style={tdStyle}>
                    {line.productTitle}
                    <div style={mutedStyle}>{line.variantTitle}</div>
                  </td>
                  <td style={tdStyle}>{line.sku || "-"}</td>
                  <td style={tdStyle}>{line.quantity}</td>
                  <td style={tdStyle}>{line.unitCost != null ? formatCurrency(line.unitCost, currencyCode) : "-"}</td>
                  <td style={tdStyle}>{line.subtotal > 0 ? formatCurrency(line.subtotal, currencyCode) : "-"}</td>
                  {isDraft && (
                    <td style={tdStyle}>
                      <Form method="post" style={{ display: "inline" }}>
                        <input type="hidden" name="intent" value="remove-line" />
                        <input type="hidden" name="lineId" value={line.id} />
                        <button type="submit" style={smallBtnStyle}>Remove</button>
                      </Form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isDraft && (
          <div style={{ marginTop: "12px", padding: "12px", border: "1px solid #dfe3e8", borderRadius: "8px" }}>
            <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>Add line item</div>
            <Form method="post">
              <input type="hidden" name="intent" value="add-line" />
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "8px" }}>
                <select
                  name="variantId"
                  required
                  style={inputStyle}
                  onChange={(e) => handleVariantChange(e.target.value)}
                >
                  <option value="">Select variant</option>
                  {variants.map((v) => {
                    const isMapped = mappings.some((m) => m.variantId === v.id);
                    return (
                      <option key={v.id} value={v.id}>
                        {v.productTitle} - {v.variantTitle} {v.sku ? `(${v.sku})` : ""}
                        {isMapped ? " ★ mapped" : ""}
                      </option>
                    );
                  })}
                </select>
                <input name="quantity" type="number" placeholder="Qty" min="1" required style={inputStyle} />
                <input
                  name="unitCost"
                  type="number"
                  step="0.01"
                  placeholder="Cost"
                  style={inputStyle}
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
              </div>
              <button type="submit" disabled={isSubmitting} style={{ ...buttonStyle, marginTop: "8px" }}>
                Add line
              </button>
            </Form>
          </div>
        )}
      </s-section>

      {isDraft && (
        <s-section heading="Edit">
          <Form method="post">
            <input type="hidden" name="intent" value="update-po" />
            <div style={formGridStyle}>
              <Field label="PO reference" name="reference" type="text" required defaultValue={po.reference} />
              <Field label="Expected arrival" name="expectedArrival" type="date" defaultValue={po.expectedArrival} />
            </div>
            <label style={fieldLabelStyle}>
              Notes
              <textarea name="notes" rows={3} style={textareaStyle} defaultValue={po.notes ?? ""} />
            </label>
            <button type="submit" disabled={isSubmitting} style={buttonStyle}>
              Save changes
            </button>
          </Form>
        </s-section>
      )}

      <s-section heading="Actions">
        <div style={{ display: "flex", gap: "8px" }}>
          <a href={`/app/purchase-orders/${po.id}/print`} style={smallBtnStyle}>Print PO</a>
          <Form method="post" style={{ display: "inline" }}>
            <input type="hidden" name="intent" value="duplicate" />
            <button type="submit" disabled={isSubmitting} style={smallBtnStyle}>Duplicate PO</button>
          </Form>
          {isDraft && (
            <Form method="post" style={{ display: "inline" }}>
              <input type="hidden" name="intent" value="delete" />
              <button type="submit" disabled={isSubmitting} style={dangerBtnStyle}>Delete PO</button>
            </Form>
          )}
        </div>
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
  return { background: c.bg, color: c.color, padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, display: "inline-block" } as const;
}

// Styles
const metaGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", marginBottom: "8px" } as const;
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "12px" } as const;
const fieldLabelStyle = { display: "grid", gap: "6px", color: "#202223", fontSize: "13px", fontWeight: 600 } as const;
const inputStyle = { border: "1px solid #c9cccf", borderRadius: "6px", padding: "9px 10px", fontSize: "14px", width: "100%" } as const;
const textareaStyle = { ...inputStyle, resize: "vertical" } as const;
const buttonStyle = { border: "0", borderRadius: "6px", padding: "10px 14px", background: "#008060", color: "#fff", fontWeight: 650, cursor: "pointer" } as const;
const smallBtnStyle = { border: "1px solid #c9cccf", borderRadius: "4px", padding: "4px 10px", background: "#fff", cursor: "pointer", fontSize: "12px" } as const;
const dangerBtnStyle = { border: "1px solid #d72c0d", borderRadius: "6px", padding: "10px 14px", background: "#fff", color: "#d72c0d", fontWeight: 650, cursor: "pointer" } as const;
const statusBtn = { border: "1px solid #c9cccf", borderRadius: "4px", padding: "6px 12px", background: "#fff", cursor: "pointer", fontSize: "12px" } as const;
const linkStyle = { color: "#2c6ecb", textDecoration: "none" } as const;
const printBtnLinkStyle = { display: "inline-block", border: "1px solid #008060", borderRadius: "6px", padding: "8px 14px", background: "#008060", color: "#fff", fontWeight: 650, textDecoration: "none", fontSize: "13px" } as const;
const mutedStyle = { color: "#6d7175", fontSize: "13px", marginTop: "4px" } as const;
const tableWrapStyle = { overflowX: "auto" } as const;
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "14px" } as const;
const thStyle = { textAlign: "left", borderBottom: "1px solid #dfe3e8", padding: "10px 8px", whiteSpace: "nowrap" } as const;
const tdStyle = { borderBottom: "1px solid #f1f2f3", padding: "10px 8px", verticalAlign: "top" } as const;
const noticeStyle = (ok: boolean) => ({ border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`, background: ok ? "#effaf5" : "#fff4f4", borderRadius: "8px", marginTop: "12px", marginBottom: "12px", padding: "10px 12px", color: ok ? "#0f5132" : "#8a1f11" }) as const;

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
