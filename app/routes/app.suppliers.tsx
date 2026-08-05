import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation , useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";

type ActionData = { ok: boolean; message: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "suppliers-loader");
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
  const { session } = await authenticateAdmin(request, "suppliers-action");
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
        <Form method="post" style={supplierFormStyle}>
          <input type="hidden" name="intent" value="create" />
          <div style={formIntroStyle}>
            <div>
              <div style={formTitleStyle}>Supplier details</div>
              <p style={formDescriptionStyle}>
                Add the supplier contact and buying terms used for purchase orders.
              </p>
            </div>
            <span style={requiredHintStyle}>Supplier name required</span>
          </div>

          <div style={formGroupStyle}>
            <div style={groupHeadingStyle}>Contact</div>
            <div style={formGridStyle}>
              <Field
                label="Supplier name"
                name="name"
                required
                placeholder="Acme Supply Co."
                helpText="The name shown on supplier lists and purchase orders."
              />
              <Field
                label="Email"
                name="email"
                type="email"
                placeholder="orders@example.com"
                helpText="Used as the primary order contact."
              />
              <Field
                label="Phone"
                name="phone"
                type="tel"
                placeholder="+1 555 0100"
                helpText="Optional contact number for urgent order issues."
              />
            </div>
          </div>

          <div style={formGroupStyle}>
            <div style={groupHeadingStyle}>Ordering terms</div>
            <div style={formGridStyle}>
              <Field
                label="Lead time"
                name="leadTimeDays"
                type="number"
                defaultValue="14"
                min="0"
                inputMode="numeric"
                suffix="days"
                helpText="Typical time from placing a PO to receiving stock."
              />
              <Field
                label="Minimum order"
                name="minimumOrder"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="500"
                helpText="Leave blank if the supplier has no minimum."
              />
              <Field
                label="Payment terms"
                name="paymentTerms"
                placeholder="Net 30"
                helpText="Examples: Due on receipt, Net 15, Net 30."
              />
            </div>
          </div>

          <div style={formGroupStyle}>
            <label style={fieldLabelStyle}>
              <span style={labelTextStyle}>Internal notes</span>
              <textarea
                name="notes"
                rows={3}
                placeholder="Packaging rules, ordering cutoff, account number, or contact notes"
                style={textareaStyle}
              />
              <span style={helpTextStyle}>Visible only inside PODesk.</span>
            </label>
          </div>

          <div style={formActionsStyle}>
            <button type="submit" disabled={isSubmitting} style={buttonStyle(isSubmitting)}>
              {isSubmitting ? "Saving..." : "Save supplier"}
            </button>
          </div>
        </Form>
      </s-section>

      <s-section heading={`Active suppliers (${activeSuppliers.length})`}>
        {activeSuppliers.length === 0 ? (
          <div style={{ padding: "18px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", textAlign: "left" }}>
            <div style={{ fontWeight: 650, fontSize: "14px", marginBottom: "6px" }}>No suppliers added yet</div>
            <p style={{ margin: "0 0 10px", color: "#6d7175", fontSize: "13px" }}>
              Add your first supplier using the form above to start mapping SKUs, setting lead times, and creating purchase orders.
            </p>
          </div>
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
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  step,
  min,
  inputMode,
  placeholder,
  helpText,
  suffix,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  step?: string;
  min?: string;
  inputMode?: "decimal" | "numeric";
  placeholder?: string;
  helpText?: string;
  suffix?: string;
}) {
  return (
    <label style={fieldLabelStyle}>
      <span style={labelTextStyle}>
        {label}
        {required ? <span style={requiredMarkStyle}>*</span> : null}
      </span>
      <span style={inputWrapStyle}>
        <input
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          step={step}
          min={min}
          inputMode={inputMode}
          placeholder={placeholder}
          style={suffix ? inputWithSuffixStyle : inputStyle}
        />
        {suffix ? <span style={suffixStyle}>{suffix}</span> : null}
      </span>
      {helpText ? <span style={helpTextStyle}>{helpText}</span> : null}
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

// Styles
const supplierFormStyle = { display: "grid", gap: "20px", background: "#ffffff", border: "1px solid #e1e3e5", borderRadius: "10px", padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" } as const;
const formIntroStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  paddingBottom: "14px",
  borderBottom: "1px solid #ebebeb",
} as const;
const formTitleStyle = { color: "#202223", fontSize: "15px", fontWeight: 700 } as const;
const formDescriptionStyle = {
  margin: "4px 0 0",
  color: "#616161",
  fontSize: "13px",
  lineHeight: 1.45,
} as const;
const requiredHintStyle = {
  flex: "0 0 auto",
  border: "1px solid #d6e6df",
  borderRadius: "999px",
  padding: "5px 10px",
  background: "#f1f8f5",
  color: "#0b5137",
  fontSize: "12px",
  fontWeight: 650,
} as const;
const formGroupStyle = { display: "grid", gap: "10px" } as const;
const groupHeadingStyle = {
  color: "#303030",
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: 0,
} as const;
const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
} as const;
const fieldLabelStyle = {
  display: "grid",
  alignContent: "start",
  gap: "6px",
  color: "#202223",
  fontSize: "13px",
  fontWeight: 600,
} as const;
const labelTextStyle = { display: "inline-flex", alignItems: "center", gap: "3px" } as const;
const requiredMarkStyle = { color: "#d72c0d", fontWeight: 700 } as const;
const inputWrapStyle = { position: "relative", display: "block" } as const;
const inputBaseStyle = {
  boxSizing: "border-box",
  border: "1px solid #8c9196",
  borderRadius: "8px",
  padding: "0 12px",
  height: "40px",
  fontSize: "14px",
  lineHeight: "20px",
  width: "100%",
  background: "#ffffff",
  color: "#202223",
  outline: "none",
} as const;
const inputStyle = inputBaseStyle;
const inputWithSuffixStyle = { ...inputBaseStyle, paddingRight: "56px" } as const;
const suffixStyle = {
  position: "absolute",
  top: "50%",
  right: "12px",
  transform: "translateY(-50%)",
  color: "#616161",
  fontSize: "13px",
  pointerEvents: "none",
} as const;
const textareaStyle = {
  ...inputBaseStyle,
  height: "auto",
  minHeight: "80px",
  padding: "10px 12px",
  resize: "vertical",
  fontFamily: "inherit",
} as const;
const helpTextStyle = {
  color: "#6d7175",
  fontSize: "12px",
  fontWeight: 400,
  lineHeight: 1.35,
} as const;
const formActionsStyle = {
  display: "flex",
  justifyContent: "flex-start",
  paddingTop: "4px",
} as const;
const buttonStyle = (disabled: boolean) =>
  ({
    border: "0",
    borderRadius: "8px",
    padding: "0 20px",
    height: "40px",
    background: disabled ? "#8bbbab" : "#008060",
    color: "#fff",
    fontWeight: 650,
    fontSize: "14px",
    cursor: disabled ? "default" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.12)",
  }) as const;
const smallBtnStyle = { height: "32px", border: "1px solid #c9cccf", borderRadius: "6px", padding: "0 12px", background: "#fff", color: "#202223", cursor: "pointer", fontSize: "13px", fontWeight: 600, display: "inline-flex", alignItems: "center" } as const;
const dangerBtnStyle = { ...smallBtnStyle, color: "#d72c0d", borderColor: "#d72c0d" } as const;
const linkStyle = { color: "#2c6ecb", textDecoration: "none", fontWeight: 600 } as const;
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
