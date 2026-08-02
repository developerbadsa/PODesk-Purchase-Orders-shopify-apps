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
  if (!store) return { mappings: [], suppliers: [], variants: [] };

  const [mappings, suppliers, variants] = await Promise.all([
    prisma.supplierVariantMapping.findMany({
      where: { storeId: store.id },
      include: {
        supplier: true,
        variant: { include: { product: true } },
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
  ]);

  return {
    mappings: mappings.map((m) => ({
      id: m.id,
      supplierId: m.supplierId,
      supplierName: m.supplier.name,
      variantId: m.variantId,
      productTitle: m.variant.product.title,
      variantTitle: m.variant.title,
      sku: m.variant.sku,
      supplierSku: m.supplierSku,
      supplierCost: m.supplierCost,
      supplierLeadTimeDays: m.supplierLeadTimeDays,
      isPrimary: m.isPrimary,
    })),
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      leadTimeDays: s.leadTimeDays,
    })),
    variants: variants.map((v) => ({
      id: v.id,
      productTitle: v.product.title,
      variantTitle: v.title,
      sku: v.sku,
      shopifyVariantId: v.shopifyVariantId,
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

  if (intent === "create-mapping") {
    const supplierId = String(formData.get("supplierId") || "").trim();
    const variantId = String(formData.get("variantId") || "").trim();
    if (!supplierId || !variantId) {
      return { ok: false, message: "Supplier and variant are required." } satisfies ActionData;
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, storeId: store.id },
    });
    const variant = await prisma.shopifyVariant.findFirst({
      where: { id: variantId, storeId: store.id },
    });
    if (!supplier || !variant) {
      return { ok: false, message: "Supplier or variant not found." } satisfies ActionData;
    }

    const existing = await prisma.supplierVariantMapping.findUnique({
      where: { supplierId_variantId: { supplierId, variantId } },
    });
    if (existing) {
      return { ok: false, message: "This supplier-variant mapping already exists." } satisfies ActionData;
    }

    const isPrimary = formData.get("isPrimary") === "on";
    await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.supplierVariantMapping.updateMany({
          where: { storeId: store.id, variantId },
          data: { isPrimary: false },
        });
      }

      await tx.supplierVariantMapping.create({
        data: {
          storeId: store.id,
          supplierId,
          variantId,
          supplierSku: optionalString(formData.get("supplierSku")),
          supplierCost: optionalNumber(formData.get("supplierCost")),
          supplierLeadTimeDays: optionalIntNumber(formData.get("supplierLeadTimeDays")),
          isPrimary,
        },
      });
    });
    return { ok: true, message: "SKU-supplier mapping created." } satisfies ActionData;
  }

  if (intent === "update-mapping") {
    const mappingId = String(formData.get("mappingId") || "").trim();
    if (!mappingId) return { ok: false, message: "Mapping ID required." } satisfies ActionData;

    const mapping = await prisma.supplierVariantMapping.findFirst({
      where: { id: mappingId, storeId: store.id },
    });
    if (!mapping) return { ok: false, message: "Mapping not found." } satisfies ActionData;

    const isPrimary = formData.get("isPrimary") === "on";
    await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.supplierVariantMapping.updateMany({
          where: { storeId: store.id, variantId: mapping.variantId, id: { not: mappingId } },
          data: { isPrimary: false },
        });
      }

      await tx.supplierVariantMapping.update({
        where: { id: mappingId },
        data: {
          supplierSku: optionalString(formData.get("supplierSku")),
          supplierCost: optionalNumber(formData.get("supplierCost")),
          supplierLeadTimeDays: optionalIntNumber(formData.get("supplierLeadTimeDays")),
          isPrimary,
        },
      });
    });
    return { ok: true, message: "Mapping updated." } satisfies ActionData;
  }

  if (intent === "delete-mapping") {
    const mappingId = String(formData.get("mappingId") || "").trim();
    await prisma.supplierVariantMapping.deleteMany({
      where: { id: mappingId, storeId: store.id },
    });
    return { ok: true, message: "Mapping removed." } satisfies ActionData;
  }

  return { ok: false, message: "Unknown action." } satisfies ActionData;
};

export default function MappingsPage() {
  const { mappings, suppliers, variants } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const isSubmitting = navigation.state === "submitting";

  const mappedVariantIds = new Set(mappings.map((m) => m.variantId));
  const unmappedVariants = variants.filter((v) => !mappedVariantIds.has(v.id));

  return (
    <s-page heading="SKU-Supplier Mappings">
      {actionData?.message ? (
        <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
      ) : null}

      <s-section heading="Assign SKU to supplier">
        {suppliers.length === 0 ? (
          <div style={{ padding: "18px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
            <div style={{ fontWeight: 650, fontSize: "14px", marginBottom: "6px" }}>No suppliers found</div>
            <p style={{ margin: "0 0 12px", color: "#6d7175", fontSize: "13px" }}>
              Add a supplier first before mapping products and SKUs.
            </p>
            <a href="/app/suppliers" style={buttonStyle}>Add Supplier</a>
          </div>
        ) : variants.length === 0 ? (
          <div style={{ padding: "18px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
            <div style={{ fontWeight: 650, fontSize: "14px", marginBottom: "6px" }}>No Shopify variants synced yet</div>
            <p style={{ margin: "0 0 12px", color: "#6d7175", fontSize: "13px" }}>
              Run inventory sync from the dashboard to pull your Shopify variants into PODesk.
            </p>
            <a href="/app" style={buttonStyle}>Go to Dashboard to Sync</a>
          </div>
        ) : (
          <Form method="post">
            <input type="hidden" name="intent" value="create-mapping" />
            <div style={formGridStyle}>
              <label style={fieldLabelStyle}>
                Supplier
                <select name="supplierId" required style={inputStyle}>
                  <option value="">Select supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label style={fieldLabelStyle}>
                Variant / SKU
                <select name="variantId" required style={inputStyle}>
                  <option value="">Select variant</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.productTitle} - {v.variantTitle} {v.sku ? `(${v.sku})` : ""}
                      {mappedVariantIds.has(v.id) ? " - already mapped" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Supplier SKU" name="supplierSku" />
              <Field label="Supplier cost" name="supplierCost" type="number" step="0.01" />
              <Field label="Lead time override (days)" name="supplierLeadTimeDays" type="number" />
              <label style={{ ...fieldLabelStyle, flexDirection: "row", alignItems: "center", gap: "8px" }}>
                <input type="checkbox" name="isPrimary" defaultChecked />
                Primary supplier
              </label>
            </div>
            <button type="submit" disabled={isSubmitting} style={buttonStyle}>
              Create mapping
            </button>
          </Form>
        )}
      </s-section>

      <s-section heading={`Current mappings (${mappings.length})`}>
        {mappings.length === 0 ? (
          <div style={{ padding: "18px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px" }}>
            <div style={{ fontWeight: 650, fontSize: "14px", marginBottom: "6px" }}>No SKU mappings created yet</div>
            <p style={{ margin: "0 0 12px", color: "#6d7175", fontSize: "13px" }}>
              Map your variants using the form above or import existing supplier mappings from Stocky / spreadsheets via CSV.
            </p>
            <a href="/app/imports" style={buttonStyle}>Import Mappings via CSV</a>
          </div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Supplier</th>
                  <th style={thStyle}>Supplier SKU</th>
                  <th style={thStyle}>Cost</th>
                  <th style={thStyle}>Lead</th>
                  <th style={thStyle}>Primary</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m) => (
                  <tr key={m.id}>
                    <td style={tdStyle}>
                      {m.productTitle}
                      <div style={mutedStyle}>{m.variantTitle}</div>
                    </td>
                    <td style={tdStyle}>{m.sku || "-"}</td>
                    <td style={tdStyle}>
                      <a href={`/app/suppliers/${m.supplierId}`} style={linkStyle}>{m.supplierName}</a>
                    </td>
                    <td style={tdStyle}>{m.supplierSku || "-"}</td>
                    <td style={tdStyle}>{m.supplierCost != null ? `$${m.supplierCost.toFixed(2)}` : "-"}</td>
                    <td style={tdStyle}>{m.supplierLeadTimeDays != null ? `${m.supplierLeadTimeDays}d` : "-"}</td>
                    <td style={tdStyle}>{m.isPrimary ? "Yes" : ""}</td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => setEditingId(editingId === m.id ? null : m.id)}
                        style={{ ...smallBtnStyle, marginRight: "4px" }}
                      >
                        {editingId === m.id ? "Cancel" : "Edit"}
                      </button>
                      <Form method="post" style={{ display: "inline" }}>
                        <input type="hidden" name="intent" value="delete-mapping" />
                        <input type="hidden" name="mappingId" value={m.id} />
                        <button type="submit" style={smallBtnStyle}>Remove</button>
                      </Form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </s-section>

      {editingId && (() => {
        const target = mappings.find((m) => m.id === editingId);
        if (!target) return null;
        return (
          <s-section heading={`Edit Mapping: ${target.productTitle} (${target.variantTitle})`}>
            <Form method="post" onSubmit={() => setEditingId(null)}>
              <input type="hidden" name="intent" value="update-mapping" />
              <input type="hidden" name="mappingId" value={target.id} />
              <div style={formGridStyle}>
                <Field label="Supplier SKU" name="supplierSku" defaultValue={target.supplierSku ?? ""} />
                <Field label="Supplier cost ($)" name="supplierCost" type="number" step="0.01" defaultValue={target.supplierCost != null ? String(target.supplierCost) : ""} />
                <Field label="Lead time override (days)" name="supplierLeadTimeDays" type="number" defaultValue={target.supplierLeadTimeDays != null ? String(target.supplierLeadTimeDays) : ""} />
                <label style={{ ...fieldLabelStyle, flexDirection: "row", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" name="isPrimary" defaultChecked={target.isPrimary} />
                  Primary supplier
                </label>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button type="submit" disabled={isSubmitting} style={buttonStyle}>
                  Save mapping update
                </button>
                <button type="button" onClick={() => setEditingId(null)} style={smallBtnStyle}>
                  Cancel
                </button>
              </div>
            </Form>
          </s-section>
        );
      })()}

      <s-section heading="Unmapped variants">
        <s-paragraph>
          {unmappedVariants.length === 0
            ? "All synced variants are mapped to a supplier."
            : `${unmappedVariants.length} variant(s) without a supplier mapping.`}
        </s-paragraph>
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

function optionalNumber(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  if (!s) return null;
  const parsed = Number(s);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function optionalIntNumber(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

// Styles
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "12px" } as const;
const fieldLabelStyle = { display: "grid", gap: "6px", color: "#202223", fontSize: "13px", fontWeight: 600 } as const;
const inputStyle = { border: "1px solid #c9cccf", borderRadius: "6px", padding: "9px 10px", fontSize: "14px", width: "100%" } as const;
const buttonStyle = { border: "0", borderRadius: "6px", padding: "10px 14px", background: "#008060", color: "#fff", fontWeight: 650, cursor: "pointer" } as const;
const smallBtnStyle = { border: "1px solid #c9cccf", borderRadius: "4px", padding: "4px 10px", background: "#fff", cursor: "pointer", fontSize: "12px" } as const;
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
