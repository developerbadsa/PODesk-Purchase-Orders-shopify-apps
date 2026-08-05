import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, redirect, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";

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
    return { ok: true, message: "Supplier updated." } satisfies ActionData;
  }

  if (intent === "remove-mapping") {
    const mappingId = String(formData.get("mappingId") || "");
    await prisma.supplierVariantMapping.deleteMany({
      where: { id: mappingId, storeId: store.id },
    });
    return { ok: true, message: "Mapping removed." } satisfies ActionData;
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
    <s-page heading={supplier.name}>
      {actionData?.message ? (
        <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
      ) : null}

      <s-section heading="Edit supplier">
        <div style={formCardStyle}>
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
            <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
              <button type="submit" disabled={isSubmitting} style={buttonStyle}>
                Save changes
              </button>
              <Form method="post" style={{ display: "inline" }}>
                <input type="hidden" name="intent" value="archive" />
                <button type="submit" style={dangerBtnStyle}>Archive supplier</button>
              </Form>
            </div>
          </Form>
        </div>
      </s-section>

      <s-section heading={`Mapped SKUs (${mappings.length})`}>
        {mappings.length === 0 ? (
          <s-paragraph>
            No SKUs mapped to this supplier yet. Go to{" "}
            <a href="/app/mappings" style={linkStyle}>SKU mappings</a> to assign products.
          </s-paragraph>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Supplier SKU</th>
                  <th style={thStyle}>Cost</th>
                  <th style={thStyle}>Lead time</th>
                  <th style={thStyle}>Actions</th>
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
                    <td style={tdStyle}>{m.supplierSku || "-"}</td>
                    <td style={tdStyle}>{m.supplierCost != null ? `$${m.supplierCost.toFixed(2)}` : "-"}</td>
                    <td style={tdStyle}>{m.supplierLeadTimeDays != null ? `${m.supplierLeadTimeDays}d` : "Default"}</td>
                    <td style={tdStyle}>
                      <Form method="post" style={{ display: "inline" }}>
                        <input type="hidden" name="intent" value="remove-mapping" />
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

      <s-section heading={`Purchase orders (${purchaseOrders.length})`}>
        {purchaseOrders.length === 0 ? (
          <s-paragraph>No purchase orders for this supplier yet.</s-paragraph>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Reference</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Lines</th>
                  <th style={thStyle}>Expected</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td style={tdStyle}>
                      <a href={`/app/purchase-orders/${po.id}`} style={linkStyle}>{po.reference}</a>
                    </td>
                    <td style={tdStyle}>{po.status.replaceAll("_", " ")}</td>
                    <td style={tdStyle}>{po.lineCount}</td>
                    <td style={tdStyle}>{po.expectedArrival ? formatDate(po.expectedArrival) : "-"}</td>
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
      <span>{label} {required ? <span style={{ color: "#d72c0d" }}>*</span> : null}</span>
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

// Styles
const formCardStyle = { background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "10px", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" } as const;
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" } as const;
const fieldLabelStyle = { display: "flex", flexDirection: "column", gap: "6px", color: "#202223", fontSize: "13px", fontWeight: 600 } as const;
const inputStyle = { height: "40px", border: "1px solid #8c9196", borderRadius: "8px", padding: "0 12px", fontSize: "14px", width: "100%", backgroundColor: "#ffffff", outline: "none", boxSizing: "border-box" } as const;
const textareaStyle = { ...inputStyle, height: "auto", minHeight: "80px", padding: "10px 12px", resize: "vertical" } as const;
const buttonStyle = { height: "40px", border: "0", borderRadius: "8px", padding: "0 20px", background: "#008060", color: "#fff", fontWeight: 650, fontSize: "14px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 2px rgba(0,0,0,0.12)" } as const;
const smallBtnStyle = { height: "32px", border: "1px solid #c9cccf", borderRadius: "6px", padding: "0 12px", background: "#fff", color: "#202223", cursor: "pointer", fontSize: "13px", fontWeight: 600, display: "inline-flex", alignItems: "center" } as const;
const dangerBtnStyle = { height: "40px", border: "1px solid #d72c0d", borderRadius: "8px", padding: "0 16px", background: "#fff", color: "#d72c0d", fontWeight: 650, fontSize: "14px", cursor: "pointer", display: "inline-flex", alignItems: "center" } as const;
const linkStyle = { color: "#2c6ecb", textDecoration: "none", fontWeight: 600 } as const;
const mutedStyle = { color: "#6d7175", fontSize: "13px", marginTop: "4px" } as const;
const tableWrapStyle = { overflowX: "auto" } as const;
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "14px" } as const;
const thStyle = { textAlign: "left", borderBottom: "1px solid #dfe3e8", padding: "12px 10px", whiteSpace: "nowrap", color: "#5c5f62", fontSize: "13px", fontWeight: 650 } as const;
const tdStyle = { borderBottom: "1px solid #f1f2f3", padding: "12px 10px", verticalAlign: "middle" } as const;
const noticeStyle = (ok: boolean) => ({ border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`, background: ok ? "#effaf5" : "#fff4f4", borderRadius: "8px", marginTop: "12px", marginBottom: "12px", padding: "12px 16px", color: ok ? "#0f5132" : "#8a1f11", fontWeight: 550 }) as const;

// Shopify requires ErrorBoundary on every route that calls authenticate.admin
// so that thrown 200/401 responses (App Bridge re-auth) are handled correctly.
export function ErrorBoundary() {
  const error = useRouteError();
  return boundary.error(error);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
