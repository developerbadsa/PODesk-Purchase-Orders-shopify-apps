import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  redirect,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";
import { PrimaryButton, DangerButton, SecondaryButton } from "../components/Button";

type ActionData = { ok: boolean; message: string };

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "supplier-detail-loader");
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) throw new Response("Store not found", { status: 404 });

  const supplier = await prisma.supplier.findFirst({
    where: { id: params.id, storeId: store.id },
    include: {
      variantMappings: {
        include: {
          variant: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      purchaseOrders: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { lines: true },
      },
    },
  });

  if (!supplier) throw new Response("Supplier not found", { status: 404 });

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      leadTimeDays: supplier.leadTimeDays,
      minimumOrder: supplier.minimumOrder,
      paymentTerms: supplier.paymentTerms,
      notes: supplier.notes,
      isArchived: supplier.isArchived,
      createdAt: supplier.createdAt.toISOString(),
    },
    mappings: supplier.variantMappings.map((m) => ({
      id: m.id,
      variantId: m.variantId,
      productTitle: m.variant.product.title,
      variantTitle: m.variant.title,
      sku: m.variant.sku,
      supplierSku: m.supplierSku,
      supplierCost: m.supplierCost,
      supplierLeadTimeDays: m.supplierLeadTimeDays,
      isPrimary: m.isPrimary,
    })),
    purchaseOrders: supplier.purchaseOrders.map((po) => ({
      id: po.id,
      reference: po.reference,
      status: po.status,
      lineCount: po.lines.length,
      expectedArrival: po.expectedArrival?.toISOString() ?? null,
      createdAt: po.createdAt.toISOString(),
    })),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "supplier-detail-action");
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) return { ok: false, message: "Store not found." } satisfies ActionData;

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "update") {
    const name = String(formData.get("name") || "").trim();
    if (!name) return { ok: false, message: "Supplier name is required." } satisfies ActionData;

    await prisma.supplier.updateMany({
      where: { id: params.id, storeId: store.id },
      data: {
        name,
        email: optionalString(formData.get("email")),
        phone: optionalString(formData.get("phone")),
        leadTimeDays: numberFromForm(formData.get("leadTimeDays"), 14),
        minimumOrder: optionalNumber(formData.get("minimumOrder")),
        paymentTerms: optionalString(formData.get("paymentTerms")),
        notes: optionalString(formData.get("notes")),
      },
    });
    return { ok: true, message: "Supplier updated successfully." } satisfies ActionData;
  }

  if (intent === "remove-mapping") {
    const mappingId = String(formData.get("mappingId") || "");
    await prisma.supplierVariantMapping.deleteMany({
      where: { id: mappingId, storeId: store.id },
    });
    return { ok: true, message: "SKU mapping removed." } satisfies ActionData;
  }

  if (intent === "archive") {
    await prisma.supplier.updateMany({
      where: { id: params.id, storeId: store.id },
      data: { isArchived: true },
    });
    return redirect("/app/suppliers");
  }

  return { ok: false, message: "Unknown action." } satisfies ActionData;
};

export default function SupplierDetailPage() {
  const { supplier, mappings, purchaseOrders } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <>
      <ui-title-bar title={supplier.name} />
      <div style={{ padding: "24px 32px", width: "100%", boxSizing: "border-box" }}>
        {actionData?.message ? (
          <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
        ) : null}

        {/* Edit supplier card */}
        <div style={sectionCardStyle}>
          <h2 style={cardHeaderStyle}>Edit Supplier Details</h2>
          <div style={cardBodyStyle}>
            <Form method="post">
              <input type="hidden" name="intent" value="update" />
              <div style={formGridStyle}>
                <Field label="Supplier name" name="name" required defaultValue={supplier.name} />
                <Field label="Email" name="email" type="email" defaultValue={supplier.email ?? ""} />
                <Field label="Phone" name="phone" defaultValue={supplier.phone ?? ""} />
                <Field label="Lead time (days)" name="leadTimeDays" type="number" defaultValue={String(supplier.leadTimeDays)} />
                <Field label="Minimum order" name="minimumOrder" type="number" defaultValue={supplier.minimumOrder != null ? String(supplier.minimumOrder) : ""} />
                <Field label="Payment terms" name="paymentTerms" defaultValue={supplier.paymentTerms ?? ""} />
              </div>
              <div style={{ marginTop: "16px" }}>
                <label style={fieldLabelStyle}>
                  <span>Notes</span>
                  <textarea name="notes" rows={3} style={textareaStyle} defaultValue={supplier.notes ?? ""} />
                </label>
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "20px", alignItems: "center" }}>
                <PrimaryButton type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save changes"}
                </PrimaryButton>
                <Form method="post" style={{ display: "inline" }}>
                  <input type="hidden" name="intent" value="archive" />
                  <DangerButton type="submit" disabled={isSubmitting}>
                    Archive supplier
                  </DangerButton>
                </Form>
              </div>
            </Form>
          </div>
        </div>

        {/* Mapped SKUs card */}
        <div style={sectionCardStyle}>
          <h2 style={cardHeaderStyle}>Mapped SKUs ({mappings.length})</h2>
          <div style={cardBodyStyle}>
            {mappings.length === 0 ? (
              <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
                No SKUs mapped to this supplier yet. Go to{" "}
                <Link to="/app/mappings" style={linkStyle}>SKU mappings</Link> to assign products.
              </p>
            ) : (
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Product</th>
                      <th style={thStyle}>SKU</th>
                      <th style={thStyle}>Supplier SKU</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Cost</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Lead time</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((m) => (
                      <tr key={m.id}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 650, color: "#111827" }}>{m.productTitle}</div>
                          <div style={mutedStyle}>{m.variantTitle}</div>
                        </td>
                        <td style={tdStyle}>{m.sku || "-"}</td>
                        <td style={tdStyle}>{m.supplierSku || "-"}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {m.supplierCost != null ? `$${m.supplierCost.toFixed(2)}` : "-"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {m.supplierLeadTimeDays != null ? `${m.supplierLeadTimeDays}d` : "Default"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <Form method="post" style={{ display: "inline" }}>
                            <input type="hidden" name="intent" value="remove-mapping" />
                            <input type="hidden" name="mappingId" value={m.id} />
                            <SecondaryButton type="submit" style={{ height: "32px", padding: "0 12px", fontSize: "13px" }}>
                              Remove
                            </SecondaryButton>
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

        {/* Recent Purchase Orders card */}
        <div style={sectionCardStyle}>
          <h2 style={cardHeaderStyle}>Recent Purchase Orders ({purchaseOrders.length})</h2>
          <div style={cardBodyStyle}>
            {purchaseOrders.length === 0 ? (
              <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>No purchase orders created for this supplier yet.</p>
            ) : (
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Reference</th>
                      <th style={thStyle}>Status</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Lines</th>
                      <th style={thStyle}>Expected Arrival</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrders.map((po) => (
                      <tr key={po.id}>
                        <td style={tdStyle}>
                          <Link to={`/app/purchase-orders/${po.id}`} style={linkStyle}>{po.reference}</Link>
                        </td>
                        <td style={tdStyle}>
                          <span style={statusBadgeStyle(po.status)}>{po.status.replaceAll("_", " ")}</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{po.lineCount}</td>
                        <td style={tdStyle}>{po.expectedArrival ? formatDate(po.expectedArrival) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  step?: string;
}) {
  return (
    <label style={fieldLabelStyle}>
      <span>
        {label} {required ? <span style={{ color: "#dc2626" }}>*</span> : null}
      </span>
      <input name={name} type={type} required={required} defaultValue={defaultValue} step={step} style={inputStyle} />
    </label>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s.length > 0 ? s : null;
}

function numberFromForm(value: FormDataEntryValue | null, fallback: number) {
  const s = String(value || "").trim();
  if (!/^\d+$/.test(s)) return fallback;
  return Number(s);
}

function optionalNumber(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  if (!s) return null;
  const parsed = Number(s);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function statusBadgeStyle(status: string) {
  const colors: Record<string, { bg: string; color: string }> = {
    DRAFT: { bg: "#f3f4f6", color: "#374151" },
    SENT: { bg: "#fef3c7", color: "#92400e" },
    CONFIRMED: { bg: "#dbeafe", color: "#1e40af" },
    PARTIALLY_RECEIVED: { bg: "#ffedd5", color: "#c2410c" },
    RECEIVED: { bg: "#dcfce7", color: "#166534" },
    CANCELLED: { bg: "#fee2e2", color: "#991b1b" },
  };
  const c = colors[status] ?? { bg: "#f3f4f6", color: "#374151" };
  return {
    background: c.bg,
    color: c.color,
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    display: "inline-block",
    whiteSpace: "nowrap",
  } as const;
}

// Styles
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
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" } as const;
const fieldLabelStyle = { display: "flex", flexDirection: "column", gap: "6px", color: "#202223", fontSize: "13px", fontWeight: 600 } as const;
const inputStyle = {
  height: "42px",
  minHeight: "42px",
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  padding: "0 14px",
  fontSize: "14px",
  width: "100%",
  outline: "none",
  backgroundColor: "#ffffff",
  color: "#111827",
} as const;
const textareaStyle = { ...inputStyle, height: "auto", minHeight: "80px", padding: "10px 14px", resize: "vertical" } as const;
const linkStyle = { color: "#2c6ecb", textDecoration: "none", fontWeight: 600 } as const;
const mutedStyle = { color: "#6b7280", fontSize: "12px", marginTop: "3px" } as const;
const tableWrapStyle = { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "12px", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" } as const;
const tableStyle = { width: "100%", borderCollapse: "separate", borderSpacing: "0", fontSize: "14px" } as const;
const thStyle = { textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "14px 12px", whiteSpace: "nowrap", backgroundColor: "#f9fafb", color: "#4b5563", fontSize: "13px", fontWeight: 650 } as const;
const tdStyle = { borderBottom: "1px solid #f3f4f6", padding: "14px 12px", verticalAlign: "middle", color: "#111827" } as const;
const noticeStyle = (ok: boolean) => ({ border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`, background: ok ? "#effaf5" : "#fff4f4", borderRadius: "8px", marginTop: "12px", marginBottom: "12px", padding: "12px 16px", color: ok ? "#0f5132" : "#8a1f11", fontWeight: 550 }) as const;

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
