import { useMemo, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { shopifyBoundaryError } from "../shopify-boundary";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";
import { SearchableSelect } from "../components/SearchableSelect";

type ActionData = { ok: boolean; message: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "mappings-loader");
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
    // Use select instead of include to avoid over-fetching product fields
    // for the variant dropdown.
    prisma.shopifyVariant.findMany({
      where: { storeId: store.id },
      select: {
        id: true,
        title: true,
        sku: true,
        shopifyVariantId: true,
        product: { select: { title: true } },
      },
      orderBy: [{ product: { title: "asc" } }, { title: "asc" }],
      take: 2000,
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
  const { session } = await authenticateAdmin(request, "mappings-action");
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
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const isSubmitting = navigation.state === "submitting";

  const mappedVariantIds = new Set(mappings.map((m) => m.variantId));
  const unmappedVariants = variants.filter((v) => !mappedVariantIds.has(v.id));

  return (
    <>
      <ui-title-bar title="SKU-Supplier Mappings" />
      <div style={{ padding: "24px 32px", maxWidth: "1600px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {actionData?.message ? (
          <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
        ) : null}

        {/* Assign SKU card */}
        <div style={sectionCardStyle}>
          <h2 style={cardHeaderStyle}>Assign SKU to Supplier</h2>
          <div style={cardBodyStyle}>
            {suppliers.length === 0 ? (
              <div style={emptyCardStyle}>
                <div style={{ fontWeight: 650, fontSize: "15px", marginBottom: "6px", color: "#202223" }}>No suppliers found</div>
                <p style={{ margin: "0 0 14px", color: "#6d7175", fontSize: "13px" }}>
                  Add a supplier first before mapping SKUs.
                </p>
                <Link to="/app/suppliers" style={buttonStyle}>Add Supplier</Link>
              </div>
            ) : variants.length === 0 ? (
              <div style={emptyCardStyle}>
                <div style={{ fontWeight: 650, fontSize: "15px", marginBottom: "6px", color: "#202223" }}>No Shopify variants synced yet</div>
                <p style={{ margin: "0 0 14px", color: "#6d7175", fontSize: "13px" }}>
                  Sync inventory first to get your products into PODesk.
                </p>
                <Link to="/app" style={buttonStyle}>Go to Dashboard to Sync</Link>
              </div>
            ) : (
              <Form method="post">
                <input type="hidden" name="intent" value="create-mapping" />
                <div style={formGridStyle}>
                  <label style={fieldLabelStyle}>
                    <span>Supplier <span style={{ color: "#d72c0d" }}>*</span></span>
                    <SearchableSelect
                      name="supplierId"
                      required
                      placeholder="Select supplier..."
                      value={selectedSupplierId}
                      onChange={setSelectedSupplierId}
                      options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  </label>
                  <VariantPicker variants={variants} mappedVariantIds={mappedVariantIds} />
                  <Field label="Supplier SKU (Optional)" name="supplierSku" placeholder="e.g. SUP-SKU-101" />
                  <Field label="Supplier cost ($)" name="supplierCost" type="number" step="0.01" placeholder="e.g. 15.50" />
                  <Field label="Lead time override (days)" name="supplierLeadTimeDays" type="number" placeholder="e.g. 14" />
                </div>
                <div style={{ margin: "14px 0 18px" }}>
                  <label style={checkboxLabelStyle}>
                    <input type="checkbox" name="isPrimary" defaultChecked style={{ width: "16px", height: "16px", accentColor: "#008060" }} />
                    Set as primary supplier for this SKU
                  </label>
                </div>
                <button type="submit" disabled={isSubmitting} style={buttonStyle}>
                  {isSubmitting ? "Saving mapping..." : "Create mapping"}
                </button>
              </Form>
            )}
          </div>
        </div>

        {/* Current Mappings Card */}
        <div style={sectionCardStyle}>
          <h2 style={cardHeaderStyle}>Current Mappings ({mappings.length})</h2>
          <div style={cardBodyStyle}>
            {mappings.length === 0 ? (
              <div style={emptyCardStyle}>
                <div style={{ fontWeight: 650, fontSize: "15px", marginBottom: "6px", color: "#202223" }}>No SKU mappings created yet</div>
                <p style={{ margin: "0 0 14px", color: "#6d7175", fontSize: "13px" }}>
                  Map your variants using the form above or import existing supplier mappings from Stocky / spreadsheets via CSV.
                </p>
                <Link to="/app/imports" style={buttonStyle}>Import Mappings via CSV</Link>
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
                      <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Lead</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Primary</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((m) => (
                      <tr key={m.id}>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600, color: "#202223" }}>{m.productTitle}</span>
                          <div style={mutedStyle}>{m.variantTitle}</div>
                        </td>
                        <td style={tdStyle}>{m.sku || "-"}</td>
                        <td style={tdStyle}>
                          <Link to={`/app/suppliers/${m.supplierId}`} style={linkStyle}>{m.supplierName}</Link>
                        </td>
                        <td style={tdStyle}>{m.supplierSku || "-"}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{m.supplierCost != null ? `$${m.supplierCost.toFixed(2)}` : "-"}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{m.supplierLeadTimeDays != null ? `${m.supplierLeadTimeDays}d` : "-"}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>{m.isPrimary ? "Yes" : ""}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
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
          </div>
        </div>

        {editingId && (() => {
          const target = mappings.find((m) => m.id === editingId);
          if (!target) return null;
          return (
            <div style={sectionCardStyle}>
              <h2 style={cardHeaderStyle}>Edit Mapping: {target.productTitle} ({target.variantTitle})</h2>
              <div style={cardBodyStyle}>
                <Form method="post" onSubmit={() => setEditingId(null)}>
                  <input type="hidden" name="intent" value="update-mapping" />
                  <input type="hidden" name="mappingId" value={target.id} />
                  <div style={formGridStyle}>
                    <Field label="Supplier SKU" name="supplierSku" defaultValue={target.supplierSku ?? ""} />
                    <Field label="Supplier cost ($)" name="supplierCost" type="number" step="0.01" defaultValue={target.supplierCost != null ? String(target.supplierCost) : ""} />
                    <Field label="Lead time override (days)" name="supplierLeadTimeDays" type="number" defaultValue={target.supplierLeadTimeDays != null ? String(target.supplierLeadTimeDays) : ""} />
                  </div>
                  <div style={{ margin: "14px 0 18px" }}>
                    <label style={checkboxLabelStyle}>
                      <input type="checkbox" name="isPrimary" defaultChecked={target.isPrimary} style={{ width: "16px", height: "16px", accentColor: "#008060" }} />
                      Set as primary supplier for this SKU
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button type="submit" disabled={isSubmitting} style={buttonStyle}>
                      Save mapping update
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} style={secondaryBtnStyle}>
                      Cancel
                    </button>
                  </div>
                </Form>
              </div>
            </div>
          );
        })()}

        {/* Unmapped variants card */}
        <div style={sectionCardStyle}>
          <h2 style={cardHeaderStyle}>Unmapped Variants ({unmappedVariants.length})</h2>
          <div style={cardBodyStyle}>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
              {unmappedVariants.length === 0
                ? "All synced variants are mapped to a supplier."
                : `${unmappedVariants.length} variant(s) without a supplier mapping.`}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function VariantPicker({
  variants,
  mappedVariantIds,
}: {
  variants: Array<{
    id: string;
    productTitle: string;
    variantTitle: string;
    sku: string | null;
    shopifyVariantId: string;
  }>;
  mappedVariantIds: Set<string>;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState("");

  const options = variants.map((v) => {
    const isMapped = mappedVariantIds.has(v.id);
    return {
      value: v.id,
      label: `${v.productTitle} - ${v.variantTitle} ${v.sku ? `(${v.sku})` : ""}${isMapped ? " [Mapped]" : ""}`,
    };
  });

  return (
    <div style={variantPickerStyle}>
      <label style={fieldLabelStyle}>
        <span>Variant / SKU <span style={{ color: "#d72c0d" }}>*</span></span>
        <SearchableSelect
          name="variantId"
          required
          placeholder="Search product, variant, SKU, or Shopify ID..."
          value={selectedVariantId}
          onChange={setSelectedVariantId}
          options={options}
        />
      </label>
      <div style={helpTextStyle}>Select the exact Shopify variant that this supplier can fulfill.</div>
    </div>
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
const formCardStyle = { background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "10px", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", position: "relative", zIndex: 5 } as const;
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" } as const;
const fieldLabelStyle = { display: "flex", flexDirection: "column", gap: "6px", color: "#202223", fontSize: "13px", fontWeight: 600 } as const;
const inputStyle = { height: "40px", border: "1px solid #8c9196", borderRadius: "8px", padding: "0 12px", fontSize: "14px", width: "100%", backgroundColor: "#ffffff", outline: "none", boxSizing: "border-box" } as const;
const variantPickerStyle = { gridColumn: "span 2", display: "flex", flexDirection: "column", gap: "8px", minWidth: 0, position: "relative", zIndex: 1000 } as const;
const selectedVariantStyle = { border: "1px solid #95c9b4", background: "#effaf5", borderRadius: "8px", padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" } as const;
const selectedVariantTitleStyle = { color: "#202223", fontSize: "14px", fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
const selectedVariantMetaStyle = { color: "#4b5563", fontSize: "12px", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
const clearSelectionButtonStyle = { border: "1px solid #95c9b4", borderRadius: "6px", background: "#ffffff", color: "#006e52", height: "30px", padding: "0 10px", fontSize: "12px", fontWeight: 650, cursor: "pointer", flexShrink: 0 } as const;
const variantResultsStyle = { position: "absolute", top: "68px", left: 0, right: 0, zIndex: 10000, border: "1px solid #dfe3e8", borderRadius: "8px", overflow: "hidden", background: "#ffffff", maxHeight: "240px", overflowY: "auto", boxShadow: "0 16px 36px rgba(0, 0, 0, 0.18)" } as const;
const variantEmptyStyle = { padding: "14px", color: "#6d7175", fontSize: "13px" } as const;
const variantOptionStyle = (selected: boolean) => ({
  width: "100%",
  border: 0,
  borderBottom: "1px solid #f1f2f3",
  background: selected ? "#f1f8f5" : "#ffffff",
  color: "#202223",
  padding: "11px 12px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  textAlign: "left",
}) as const;
const variantOptionTitleStyle = { display: "block", fontSize: "13px", fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
const variantOptionMetaStyle = { display: "block", color: "#6d7175", fontSize: "12px", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
const mappedBadgeStyle = { border: "1px solid #b7d8ff", background: "#f4f8ff", color: "#1f5199", borderRadius: "999px", padding: "3px 8px", fontSize: "11px", fontWeight: 650, flexShrink: 0 } as const;
const helpTextStyle = { color: "#6d7175", fontSize: "12px" } as const;
const buttonStyle = { height: "40px", border: "0", borderRadius: "8px", padding: "0 20px", background: "#008060", color: "#fff", fontWeight: 650, fontSize: "14px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" } as const;
const smallBtnStyle = { height: "32px", border: "1px solid #c9cccf", borderRadius: "6px", padding: "0 12px", background: "#fff", color: "#202223", cursor: "pointer", fontSize: "13px", fontWeight: 600, display: "inline-flex", alignItems: "center" } as const;
const checkboxLabelStyle = { display: "inline-flex", alignItems: "center", gap: "8px", color: "#202223", fontSize: "14px", fontWeight: 550, cursor: "pointer", userSelect: "none" } as const;
const linkStyle = { color: "#2c6ecb", textDecoration: "none", fontWeight: 600 } as const;
const mutedStyle = { color: "#6d7175", fontSize: "13px", marginTop: "4px" } as const;
const tableWrapStyle = { overflowX: "auto" } as const;
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "14px" } as const;
const thStyle = { textAlign: "left", borderBottom: "1px solid #dfe3e8", padding: "12px 10px", whiteSpace: "nowrap", color: "#5c5f62", fontSize: "13px", fontWeight: 650 } as const;
const tdStyle = { borderBottom: "1px solid #f1f2f3", padding: "12px 10px", verticalAlign: "middle" } as const;
const sectionCardStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)",
  marginBottom: "24px",
  overflow: "hidden",
  width: "100%",
  boxSizing: "border-box",
} as const;
const cardHeaderStyle = {
  margin: 0,
  padding: "16px 24px",
  fontSize: "16px",
  fontWeight: 700,
  color: "#111827",
  borderBottom: "1px solid #f3f4f6",
  backgroundColor: "#f9fafb",
} as const;
const cardBodyStyle = { padding: "24px" } as const;
const emptyCardStyle = { padding: "24px", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", textAlign: "left" } as const;
const secondaryBtnStyle = { height: "40px", border: "1px solid #d1d5db", borderRadius: "8px", padding: "0 16px", background: "#ffffff", color: "#374151", fontWeight: 600, fontSize: "14px", cursor: "pointer" } as const;

const noticeStyle = (ok: boolean) => ({ border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`, background: ok ? "#effaf5" : "#fff4f4", borderRadius: "8px", marginTop: "12px", marginBottom: "12px", padding: "12px 16px", color: ok ? "#0f5132" : "#8a1f11", fontWeight: 550 }) as const;


// Shopify requires ErrorBoundary on every route that calls authenticate.admin
// so that thrown 200/401 responses (App Bridge re-auth) are handled correctly.
export function ErrorBoundary() {
  const error = useRouteError();
  const shopifyError = shopifyBoundaryError(error);
  if (shopifyError) return shopifyError;
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


