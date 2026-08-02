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
  if (!store) return { suppliers: [] };

  const suppliers = await prisma.supplier.findMany({
    where: { storeId: store.id },
    include: {
      _count: { select: { purchaseOrders: true, variantMappings: true } },
    },
    orderBy: [{ isArchived: "asc" }, { name: "asc" }],
  });

  return {
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      leadTimeDays: s.leadTimeDays,
      minimumOrder: s.minimumOrder,
      paymentTerms: s.paymentTerms,
      notes: s.notes,
      isArchived: s.isArchived,
      poCount: s._count.purchaseOrders,
      mappingCount: s._count.variantMappings,
      createdAt: s.createdAt.toISOString(),
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

  if (intent === "create") {
    const name = String(formData.get("name") || "").trim();
    if (!name) return { ok: false, message: "Supplier name is required." } satisfies ActionData;

    await prisma.supplier.create({
      data: {
        storeId: store.id,
        name,
        email: optionalString(formData.get("email")),
        phone: optionalString(formData.get("phone")),
        leadTimeDays: numberFromForm(formData.get("leadTimeDays"), 14),
        minimumOrder: optionalNumber(formData.get("minimumOrder")),
        paymentTerms: optionalString(formData.get("paymentTerms")),
        notes: optionalString(formData.get("notes")),
      },
    });
    return { ok: true, message: "Supplier created." } satisfies ActionData;
  }

  if (intent === "update") {
    const id = String(formData.get("id") || "");
    const name = String(formData.get("name") || "").trim();
    if (!id || !name) return { ok: false, message: "Supplier ID and name required." } satisfies ActionData;

    await prisma.supplier.updateMany({
      where: { id, storeId: store.id },
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

  if (intent === "archive") {
    const id = String(formData.get("id") || "");
    if (!id) return { ok: false, message: "Supplier ID required." } satisfies ActionData;
    await prisma.supplier.updateMany({
      where: { id, storeId: store.id },
      data: { isArchived: true },
    });
    return { ok: true, message: "Supplier archived." } satisfies ActionData;
  }

  if (intent === "restore") {
    const id = String(formData.get("id") || "");
    if (!id) return { ok: false, message: "Supplier ID required." } satisfies ActionData;
    await prisma.supplier.updateMany({
      where: { id, storeId: store.id },
      data: { isArchived: false },
    });
    return { ok: true, message: "Supplier restored." } satisfies ActionData;
  }

  if (intent === "delete") {
    const id = String(formData.get("id") || "");
    if (!id) return { ok: false, message: "Supplier ID required." } satisfies ActionData;
    // Only delete if no POs reference this supplier
    const poCount = await prisma.purchaseOrder.count({ where: { supplierId: id, storeId: store.id } });
    if (poCount > 0) {
      return { ok: false, message: "Cannot delete supplier with purchase orders. Archive instead." } satisfies ActionData;
    }
    await prisma.supplierVariantMapping.deleteMany({ where: { supplierId: id, storeId: store.id } });
    await prisma.supplier.deleteMany({ where: { id, storeId: store.id } });
    return { ok: true, message: "Supplier deleted." } satisfies ActionData;
  }

  return { ok: false, message: "Unknown action." } satisfies ActionData;
};

export default function SuppliersPage() {
  const { suppliers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const activeSuppliers = suppliers.filter((s) => !s.isArchived);
  const archivedSuppliers = suppliers.filter((s) => s.isArchived);

  return (
    <s-page heading="Suppliers">
      {actionData?.message ? (
        <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
      ) : null}

      <s-section heading="Add supplier">
        <Form method="post">
          <input type="hidden" name="intent" value="create" />
          <div style={formGridStyle}>
            <Field label="Supplier name" name="name" required />
            <Field label="Email" name="email" type="email" />
            <Field label="Phone" name="phone" />
            <Field label="Lead time (days)" name="leadTimeDays" type="number" defaultValue="14" />
            <Field label="Minimum order" name="minimumOrder" type="number" />
            <Field label="Payment terms" name="paymentTerms" />
          </div>
          <label style={fieldLabelStyle}>
            Notes
            <textarea name="notes" rows={2} style={textareaStyle} />
          </label>
          <button type="submit" disabled={isSubmitting} style={buttonStyle}>
            Save supplier
          </button>
        </Form>
      </s-section>

      <s-section heading={`Active suppliers (${activeSuppliers.length})`}>
        {activeSuppliers.length === 0 ? (
          <s-paragraph>No suppliers yet. Add one above.</s-paragraph>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Lead time</th>
                  <th style={thStyle}>SKUs</th>
                  <th style={thStyle}>POs</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td style={tdStyle}>
                      <a href={`/app/suppliers/${supplier.id}`} style={linkStyle}>
                        {supplier.name}
                      </a>
                    </td>
                    <td style={tdStyle}>{supplier.email || "-"}</td>
                    <td style={tdStyle}>{supplier.leadTimeDays}d</td>
                    <td style={tdStyle}>{supplier.mappingCount}</td>
                    <td style={tdStyle}>{supplier.poCount}</td>
                    <td style={tdStyle}>
                      <Form method="post" style={{ display: "inline" }}>
                        <input type="hidden" name="intent" value="archive" />
                        <input type="hidden" name="id" value={supplier.id} />
                        <button type="submit" style={smallBtnStyle}>Archive</button>
                      </Form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </s-section>

      {archivedSuppliers.length > 0 && (
        <s-section heading={`Archived (${archivedSuppliers.length})`}>
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>POs</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td style={tdStyle}>{supplier.name}</td>
                    <td style={tdStyle}>{supplier.poCount}</td>
                    <td style={tdStyle}>
                      <Form method="post" style={{ display: "inline", marginRight: 8 }}>
                        <input type="hidden" name="intent" value="restore" />
                        <input type="hidden" name="id" value={supplier.id} />
                        <button type="submit" style={smallBtnStyle}>Restore</button>
                      </Form>
                      {supplier.poCount === 0 && (
                        <Form method="post" style={{ display: "inline" }}>
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="id" value={supplier.id} />
                          <button type="submit" style={dangerBtnStyle}>Delete</button>
                        </Form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </s-section>
      )}
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

function numberFromForm(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  if (!s) return null;
  const parsed = Number(s);
  return Number.isFinite(parsed) ? parsed : null;
}

// Styles
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "12px" } as const;
const fieldLabelStyle = { display: "grid", gap: "6px", color: "#202223", fontSize: "13px", fontWeight: 600 } as const;
const inputStyle = { border: "1px solid #c9cccf", borderRadius: "6px", padding: "9px 10px", fontSize: "14px", width: "100%" } as const;
const textareaStyle = { ...inputStyle, resize: "vertical" } as const;
const buttonStyle = { border: "0", borderRadius: "6px", padding: "10px 14px", background: "#008060", color: "#fff", fontWeight: 650, cursor: "pointer" } as const;
const smallBtnStyle = { border: "1px solid #c9cccf", borderRadius: "4px", padding: "4px 10px", background: "#fff", cursor: "pointer", fontSize: "12px" } as const;
const dangerBtnStyle = { ...smallBtnStyle, color: "#d72c0d", borderColor: "#d72c0d" } as const;
const linkStyle = { color: "#2c6ecb", textDecoration: "none" } as const;
const tableWrapStyle = { overflowX: "auto" } as const;
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "14px" } as const;
const thStyle = { textAlign: "left", borderBottom: "1px solid #dfe3e8", padding: "10px 8px", whiteSpace: "nowrap" } as const;
const tdStyle = { borderBottom: "1px solid #f1f2f3", padding: "10px 8px", verticalAlign: "top" } as const;
const noticeStyle = (ok: boolean) => ({ border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`, background: ok ? "#effaf5" : "#fff4f4", borderRadius: "8px", marginTop: "12px", marginBottom: "12px", padding: "10px 12px", color: ok ? "#0f5132" : "#8a1f11" }) as const;

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
