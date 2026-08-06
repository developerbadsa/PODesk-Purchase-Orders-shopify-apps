import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, Link, useActionData, useLoaderData, useNavigation, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";
import { PrimaryButton, SecondaryButton, DangerButton } from "../components/Button";

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
    <>
      <ui-title-bar title="Suppliers" />
      <div style={{ padding: "24px 32px", width: "100%", boxSizing: "border-box" }}>
        {actionData?.message ? (
          <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
        ) : null}

        {/* Add supplier card */}
        <div style={sectionCardStyle}>
          <h2 style={cardHeaderStyle}>Add New Supplier</h2>
          <div style={cardBodyStyle}>
            <Form method="post" style={{ display: "grid", gap: "20px" }}>
              <input type="hidden" name="intent" value="create" />
              <div style={formIntroStyle}>
                <div>
                  <div style={formTitleStyle}>Supplier Details & Terms</div>
                  <p style={formDescriptionStyle}>
                    Add supplier contact details and buying terms used for automated purchase orders.
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
                <div style={groupHeadingStyle}>Ordering Terms</div>
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
                <PrimaryButton type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save supplier"}
                </PrimaryButton>
              </div>
            </Form>
          </div>
        </div>

        {/* Active suppliers table card */}
        <div style={sectionCardStyle}>
          <h2 style={cardHeaderStyle}>Active Suppliers ({activeSuppliers.length})</h2>
          <div style={cardBodyStyle}>
            {activeSuppliers.length === 0 ? (
              <div style={emptyCardStyle}>
                <div style={{ fontWeight: 650, fontSize: "15px", marginBottom: "6px" }}>No suppliers added yet</div>
                <p style={{ margin: 0, color: "#6d7175", fontSize: "13px" }}>
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
                      <th style={{ ...thStyle, textAlign: "right" }}>Lead time</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Mapped SKUs</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>POs</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSuppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td style={tdStyle}>
                          <Link to={`/app/suppliers/${supplier.id}`} style={linkStyle}>
                            {supplier.name}
                          </Link>
                        </td>
                        <td style={tdStyle}>{supplier.email || "-"}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{supplier.leadTimeDays}d</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{supplier.mappingCount}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{supplier.poCount}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <Form method="post" style={{ display: "inline" }}>
                            <input type="hidden" name="intent" value="archive" />
                            <input type="hidden" name="id" value={supplier.id} />
                            <SecondaryButton type="submit" style={{ height: "32px", padding: "0 12px", fontSize: "13px" }}>
                              Archive
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

        {/* Archived suppliers card */}
        {archivedSuppliers.length > 0 && (
          <div style={sectionCardStyle}>
            <h2 style={cardHeaderStyle}>Archived Suppliers ({archivedSuppliers.length})</h2>
            <div style={cardBodyStyle}>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>POs</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedSuppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td style={tdStyle}>{supplier.name}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>{supplier.poCount}</td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                            <Form method="post" style={{ display: "inline" }}>
                              <input type="hidden" name="intent" value="restore" />
                              <input type="hidden" name="id" value={supplier.id} />
                              <SecondaryButton type="submit" style={{ height: "32px", padding: "0 12px", fontSize: "13px" }}>
                                Restore
                              </SecondaryButton>
                            </Form>
                            {supplier.poCount === 0 && (
                              <Form method="post" style={{ display: "inline" }}>
                                <input type="hidden" name="intent" value="delete" />
                                <input type="hidden" name="id" value={supplier.id} />
                                <DangerButton type="submit" style={{ height: "32px", padding: "0 12px", fontSize: "13px" }}>
                                  Delete
                                </DangerButton>
                              </Form>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
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
const formIntroStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  paddingBottom: "14px",
  borderBottom: "1px solid #ebebeb",
} as const;
const formTitleStyle = { color: "#111827", fontSize: "15px", fontWeight: 700 } as const;
const formDescriptionStyle = {
  margin: "4px 0 0",
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: 1.45,
} as const;
const requiredHintStyle = {
  flex: "0 0 auto",
  border: "1px solid #bbf7d0",
  borderRadius: "999px",
  padding: "5px 12px",
  background: "#f0fdf4",
  color: "#166534",
  fontSize: "12px",
  fontWeight: 650,
} as const;
const formGroupStyle = { display: "grid", gap: "10px" } as const;
const groupHeadingStyle = {
  color: "#374151",
  fontSize: "13px",
  fontWeight: 700,
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
  color: "#111827",
  fontSize: "13px",
  fontWeight: 600,
} as const;
const labelTextStyle = { display: "inline-flex", alignItems: "center", gap: "3px" } as const;
const requiredMarkStyle = { color: "#dc2626", fontWeight: 700 } as const;
const inputWrapStyle = { position: "relative", display: "block" } as const;
const inputBaseStyle = {
  boxSizing: "border-box",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  padding: "0 14px",
  height: "42px",
  minHeight: "42px",
  fontSize: "14px",
  lineHeight: "20px",
  width: "100%",
  background: "#ffffff",
  color: "#111827",
  outline: "none",
} as const;
const inputStyle = inputBaseStyle;
const inputWithSuffixStyle = { ...inputBaseStyle, paddingRight: "56px" } as const;
const suffixStyle = {
  position: "absolute",
  top: "50%",
  right: "14px",
  transform: "translateY(-50%)",
  color: "#6b7280",
  fontSize: "13px",
  pointerEvents: "none",
} as const;
const textareaStyle = {
  ...inputBaseStyle,
  height: "auto",
  minHeight: "80px",
  padding: "10px 14px",
  resize: "vertical",
  fontFamily: "inherit",
} as const;
const helpTextStyle = {
  color: "#6b7280",
  fontSize: "12px",
  fontWeight: 400,
  lineHeight: 1.35,
} as const;
const formActionsStyle = {
  display: "flex",
  justifyContent: "flex-start",
  paddingTop: "4px",
} as const;
const linkStyle = { color: "#2c6ecb", textDecoration: "none", fontWeight: 600 } as const;
const emptyCardStyle = { padding: "24px", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", textAlign: "left" } as const;
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
