import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation , useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";
import { createImportPreview, executeImportJob, remapImportPreview } from "../imports.server";
import {
  FIELD_DEFINITIONS,
  TARGET_FIELDS,
  type TargetField,
  type NormalizedRowData,
} from "../utils";

type ActionData = {
  ok: boolean;
  message: string;
  job?: {
    id: string;
    filename: string | null;
    status: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    importedSuppliers: number;
    importedMappings: number;
    originalHeaders: string[];
    detectedMapping: Record<TargetField, string>;
    rows: Array<{
      id: string;
      rowNumber: number;
      status: string;
      errorMessage: string | null;
      rawData: Record<string, string>;
      normalizedData: {
        sku: string;
        supplierName: string;
        supplierSku: string | null;
        supplierCost: number | null;
        leadTimeDays: number | null;
        paymentTerms: string | null;
        minimumOrder: number | null;
        notes: string | null;
      } | null;
    }>;
  };
};

const SAMPLE_CSV = `sku,supplierName,supplierSku,supplierCost,leadTimeDays,paymentTerms,minimumOrder,notes
SKU-SHIRT-M,Acme Wholesale,ACME-101,12.50,14,Net 30,500,Main apparel supplier
SKU-HAT-RED,North Supply,NS-99,8.00,21,Prepaid,250,Headwear supplier`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "imports-loader");
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) {
    return {
      supplierCount: 0,
      mappingCount: 0,
      purchaseOrderCount: 0,
      importJobs: [],
    };
  }

  const [supplierCount, mappingCount, purchaseOrderCount, importJobs] =
    await Promise.all([
      prisma.supplier.count({ where: { storeId: store.id } }),
      prisma.supplierVariantMapping.count({ where: { storeId: store.id } }),
      prisma.purchaseOrder.count({ where: { storeId: store.id } }),
      prisma.importJob.findMany({
        where: { storeId: store.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

  return {
    supplierCount,
    mappingCount,
    purchaseOrderCount,
    importJobs: importJobs.map((job) => ({
      id: job.id,
      filename: job.filename ?? "Unnamed CSV",
      type: job.type,
      status: job.status,
      totalRows: job.totalRows,
      validRows: job.validRows,
      invalidRows: job.invalidRows,
      importedSuppliers: job.importedSuppliers,
      importedMappings: job.importedMappings,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "imports-action");
  const store = await prisma.store.upsert({
    where: { shop: session.shop },
    update: {},
    create: { shop: session.shop },
  });

  const contentType = request.headers.get("content-type") || "";
  let formData: FormData;

  if (contentType.includes("multipart/form-data")) {
    formData = await request.formData();
  } else {
    formData = await request.formData();
  }

  const intent = String(formData.get("intent") || "");

  if (intent === "preview-csv") {
    let csvContent = "";
    let filename = "supplier_mapping_import.csv";

    const file = formData.get("csvFile");
    if (file && typeof file === "object" && "text" in file && typeof file.text === "function") {
      const uploadedFile = file as File;
      if (uploadedFile.name) filename = uploadedFile.name;
      csvContent = await uploadedFile.text();
    }

    if (!csvContent.trim()) {
      csvContent = String(formData.get("csvText") || "").trim();
    }

    if (!csvContent) {
      return {
        ok: false,
        message: "Please choose a CSV file or paste CSV text to preview.",
      } satisfies ActionData;
    }

    try {
      const job = await createImportPreview(store.id, filename, csvContent);
      return {
        ok: true,
        message: `CSV parsed successfully. Found ${job.validRows} valid row(s) and ${job.invalidRows} invalid row(s).`,
        job: formatJobForAction(job),
      } satisfies ActionData;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `CSV parsing failed: ${msg}` } satisfies ActionData;
    }
  }

  if (intent === "confirm-import") {
    const jobId = String(formData.get("jobId") || "").trim();
    if (!jobId) {
      return { ok: false, message: "Missing import job ID." } satisfies ActionData;
    }

    try {
      const updatedJob = await executeImportJob(store.id, jobId);
      return {
        ok: true,
        message: `Import completed successfully. Created/updated ${updatedJob.importedSuppliers} supplier(s) and ${updatedJob.importedMappings} SKU mapping(s).`,
        job: formatJobForAction(updatedJob),
      } satisfies ActionData;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Import execution failed: ${msg}` } satisfies ActionData;
    }
  }

  if (intent === "remap-preview") {
    const jobId = String(formData.get("jobId") || "").trim();
    if (!jobId) {
      return { ok: false, message: "Missing import job ID." } satisfies ActionData;
    }

    const customMapping = TARGET_FIELDS.reduce(
      (acc, field) => {
        acc[field] = String(formData.get(`mapping_${field}`) || "").trim();
        return acc;
      },
      {} as Record<TargetField, string>
    );

    try {
      const remappedJob = await remapImportPreview(store.id, jobId, customMapping);
      return {
        ok: true,
        message: `Column mapping updated. Found ${remappedJob.validRows} valid row(s) and ${remappedJob.invalidRows} invalid row(s).`,
        job: formatJobForAction(remappedJob),
      } satisfies ActionData;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Column remapping failed: ${msg}` } satisfies ActionData;
    }
  }

  if (intent === "delete-job") {
    const jobId = String(formData.get("jobId") || "").trim();
    if (jobId) {
      await prisma.importJob.deleteMany({
        where: { id: jobId, storeId: store.id },
      });
    }
    return { ok: true, message: "Import record removed." } satisfies ActionData;
  }

  return { ok: false, message: "Unknown action." } satisfies ActionData;
};

// Helper format function for action response
function formatJobForAction(job: {
  id: string;
  filename: string | null;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedSuppliers: number;
  importedMappings: number;
  originalHeaders: string | null;
  detectedMapping: string | null;
  rows: Array<{
    id: string;
    rowNumber: number;
    status: string;
    errorMessage: string | null;
    rawData: string;
    normalizedData: string | null;
  }>;
}) {
  const originalHeaders = job.originalHeaders ? (JSON.parse(job.originalHeaders) as string[]) : [];
  const detectedMapping = job.detectedMapping
    ? (JSON.parse(job.detectedMapping) as Record<TargetField, string>)
    : ({} as Record<TargetField, string>);

  return {
    id: job.id,
    filename: job.filename,
    status: job.status,
    totalRows: job.totalRows,
    validRows: job.validRows,
    invalidRows: job.invalidRows,
    importedSuppliers: job.importedSuppliers,
    importedMappings: job.importedMappings,
    originalHeaders,
    detectedMapping,
    rows: job.rows.map((r) => ({
      id: r.id,
      rowNumber: r.rowNumber,
      status: r.status,
      errorMessage: r.errorMessage,
      rawData: r.rawData ? (JSON.parse(r.rawData) as Record<string, string>) : {},
      normalizedData: r.normalizedData
        ? (JSON.parse(r.normalizedData) as NormalizedRowData)
        : null,
    })),
  };
}

export default function ImportsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const activeJob = actionData?.job;

  return (
    <s-page heading="Stocky import">
      {actionData?.message ? (
        <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
      ) : null}

      <s-section heading="Migration metrics">
        <div style={metricGridStyle}>
          <Metric label="Suppliers" value={data.supplierCount} />
          <Metric label="SKU mappings" value={data.mappingCount} />
          <Metric label="Purchase orders" value={data.purchaseOrderCount} />
          <Metric label="Import jobs" value={data.importJobs.length} />
        </div>
      </s-section>

      {/* SAMPLE CSV DOWNLOAD BANNER */}
      <s-section heading="Import Template & Data Safety">
        <div style={sampleBannerStyle}>
          <div>
            <div style={{ fontWeight: 650, fontSize: "14px", marginBottom: "4px" }}>
              Download Sample CSV Template
            </div>
            <div style={{ color: "#5c5f62", fontSize: "13px" }}>
              Need a starting template? Download our sample CSV file with standard column headers for supplier names, SKUs, unit costs, and lead times. All CSV uploads are previewed safely before creating any records.
            </div>
          </div>
          <a
            href="/app/imports/sample-csv"
            download="podesk-supplier-sku-import-sample.csv"
            style={secondaryBtnStyle}
          >
            Download sample CSV
          </a>
        </div>
      </s-section>

      {/* STEP 1: UPLOAD / PASTE FORM */}
      <s-section heading="Upload supplier SKU mappings CSV">
        <p style={bodyStyle}>
          Upload or paste a CSV export from Stocky, spreadsheets, or supplier lists to create suppliers and SKU mappings automatically.
        </p>

        <div style={{ marginBottom: "16px", padding: "12px", background: "#f4f6f8", borderRadius: "6px", border: "1px solid #dfe3e8" }}>
          <div style={{ fontWeight: 650, fontSize: "13px", marginBottom: "6px" }}>Supported CSV Columns</div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "12px", color: "#5c5f62" }}>
            <div><strong>sku*</strong> (Shopify SKU)</div>
            <div><strong>supplierName*</strong> (Company name)</div>
            <div><strong>supplierSku</strong> (Part #)</div>
            <div><strong>supplierCost</strong> (Unit cost)</div>
            <div><strong>leadTimeDays</strong> (Lead time)</div>
            <div><strong>paymentTerms</strong> (Terms)</div>
            <div><strong>minimumOrder</strong> (Min Qty)</div>
            <div><strong>notes</strong> (Internal notes)</div>
          </div>
        </div>

        <Form method="post" encType="multipart/form-data">
          <input type="hidden" name="intent" value="preview-csv" />

          <div style={typeBadgeStyle}>
            Type: <strong>Supplier SKU Mappings</strong>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={fieldLabelStyle}>
              Choose CSV File
              <input
                type="file"
                name="csvFile"
                accept=".csv,text/csv"
                style={fileInputStyle}
              />
            </label>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={fieldLabelStyle}>
              Or Paste CSV Text
              <textarea
                name="csvText"
                rows={6}
                placeholder={SAMPLE_CSV}
                style={textareaStyle}
              />
            </label>
          </div>

          <button type="submit" disabled={isSubmitting} style={buttonStyle}>
            {isSubmitting ? "Parsing CSV..." : "Preview CSV"}
          </button>
        </Form>
      </s-section>

      {/* STEP 2: PREVIEW & CONFIRM IMPORT */}
      {activeJob && (
        <s-section heading={`Preview: ${activeJob.filename || "CSV Import"}`}>
          <div style={previewSummaryStyle}>
            <div>
              <strong>Status:</strong>{" "}
              <span style={statusBadgeStyle(activeJob.status)}>
                {activeJob.status}
              </span>
            </div>
            <div><strong>Total rows:</strong> {activeJob.totalRows}</div>
            <div><strong style={{ color: "#0f5132" }}>Valid rows:</strong> {activeJob.validRows}</div>
            <div><strong style={{ color: "#8a1f11" }}>Invalid rows:</strong> {activeJob.invalidRows}</div>
            {activeJob.invalidRows > 0 && (
              <a
                href={`/app/imports/invalid-csv/${activeJob.id}`}
                download={`invalid-rows-${activeJob.id}.csv`}
                style={dangerOutlineBtnStyle}
              >
                Download invalid rows
              </a>
            )}
          </div>

          {/* COLUMN MAPPING DETECTION */}
          <div style={{ marginTop: "16px", marginBottom: "16px" }}>
            <div style={subHeadingStyle}>Column mapping</div>
            <Form method="post">
              <input type="hidden" name="intent" value="remap-preview" />
              <input type="hidden" name="jobId" value={activeJob.id} />
              <div style={mappingGridStyle}>
                {TARGET_FIELDS.map((field) => {
                  const def = FIELD_DEFINITIONS[field];
                  const detectedHeader = activeJob.detectedMapping[field] || "";
                  return (
                    <label key={field} style={mappingCardStyle}>
                      <span style={{ fontWeight: 600, fontSize: "13px" }}>
                        {def.label} {def.required && <span style={{ color: "#d72c0d" }}>*</span>}
                      </span>
                      <span style={mutedStyle}>{def.description}</span>
                      <select
                        name={`mapping_${field}`}
                        defaultValue={detectedHeader}
                        style={selectStyle}
                      >
                        <option value="">Not mapped</option>
                        {activeJob.originalHeaders.map((header) => (
                          <option key={`${field}-${header}`} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
              <button type="submit" disabled={isSubmitting} style={{ ...buttonStyle, marginTop: "12px" }}>
                {isSubmitting ? "Updating mapping..." : "Update mapping preview"}
              </button>
            </Form>
          </div>

          {/* CONFIRM IMPORT BUTTON */}
          {activeJob.status === "PREVIEW" && activeJob.validRows > 0 ? (
            <div style={{ marginTop: "20px", marginBottom: "20px" }}>
              <Form method="post">
                <input type="hidden" name="intent" value="confirm-import" />
                <input type="hidden" name="jobId" value={activeJob.id} />
                <button type="submit" disabled={isSubmitting} style={primaryButtonStyle}>
                  {isSubmitting ? "Importing..." : `Confirm & Import ${activeJob.validRows} Valid Row(s)`}
                </button>
              </Form>
            </div>
          ) : activeJob.status === "PREVIEW" && activeJob.validRows === 0 ? (
            <div style={{ marginTop: "16px", marginBottom: "16px", padding: "12px", background: "#fff4f4", border: "1px solid #e0b3b2", borderRadius: "6px", color: "#8a1f11", fontSize: "13px" }}>
              No valid rows available to import. Please verify column mappings above or correct invalid SKU / supplier fields.
            </div>
          ) : null}

          {/* ROW PREVIEW TABLE */}
          <div style={{ marginTop: "16px" }}>
            <div style={subHeadingStyle}>Row Validation Preview ({activeJob.rows.length})</div>
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Row #</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>SKU</th>
                    <th style={thStyle}>Supplier</th>
                    <th style={thStyle}>Supplier SKU</th>
                    <th style={thStyle}>Cost</th>
                    <th style={thStyle}>Lead Time</th>
                    <th style={thStyle}>Notes / Error</th>
                  </tr>
                </thead>
                <tbody>
                  {activeJob.rows.map((r) => {
                    const norm = r.normalizedData;
                    return (
                      <tr key={r.id} style={{ background: r.status === "INVALID" ? "#fff8f8" : "inherit" }}>
                        <td style={tdStyle}>{r.rowNumber}</td>
                        <td style={tdStyle}>
                          <span style={statusBadgeStyle(r.status)}>{r.status}</span>
                        </td>
                        <td style={tdStyle}>{norm?.sku || r.rawData["sku"] || "-"}</td>
                        <td style={tdStyle}>{norm?.supplierName || r.rawData["supplierName"] || "-"}</td>
                        <td style={tdStyle}>{norm?.supplierSku || "-"}</td>
                        <td style={tdStyle}>
                          {norm?.supplierCost != null ? `$${norm.supplierCost.toFixed(2)}` : "-"}
                        </td>
                        <td style={tdStyle}>
                          {norm?.leadTimeDays != null ? `${norm.leadTimeDays}d` : "-"}
                        </td>
                        <td style={tdStyle}>
                          {r.errorMessage ? (
                            <span style={{ color: "#d72c0d", fontWeight: 600 }}>{r.errorMessage}</span>
                          ) : (
                            norm?.notes || "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </s-section>
      )}

      {/* IMPORT HISTORY */}
      <s-section heading={`Import History (${data.importJobs.length})`}>
        {data.importJobs.length === 0 ? (
          <s-paragraph>No CSV imports performed yet. Upload or paste a CSV above to get started.</s-paragraph>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Filename</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Valid</th>
                  <th style={thStyle}>Invalid</th>
                  <th style={thStyle}>Imported Mappings</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.importJobs.map((j) => (
                  <tr key={j.id}>
                    <td style={tdStyle}>
                      <strong>{j.filename}</strong>
                    </td>
                    <td style={tdStyle}>
                      <span style={statusBadgeStyle(j.status)}>{j.status}</span>
                    </td>
                    <td style={tdStyle}>{j.totalRows}</td>
                    <td style={tdStyle}>{j.validRows}</td>
                    <td style={tdStyle}>{j.invalidRows}</td>
                    <td style={tdStyle}>{j.importedMappings}</td>
                    <td style={tdStyle}>{formatDate(j.createdAt)}</td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {j.invalidRows > 0 && (
                          <a
                            href={`/app/imports/invalid-csv/${j.id}`}
                            download={`invalid-rows-${j.id}.csv`}
                            style={smallDangerLinkStyle}
                          >
                            Download invalid rows
                          </a>
                        )}
                        <Form method="post" style={{ display: "inline" }}>
                          <input type="hidden" name="intent" value="delete-job" />
                          <input type="hidden" name="jobId" value={j.id} />
                          <button type="submit" style={smallBtnStyle}>Delete</button>
                        </Form>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={metricStyle}>
      <div style={metricValueStyle}>{value.toLocaleString()}</div>
      <div style={mutedStyle}>{label}</div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}

function statusBadgeStyle(status: string) {
  const colors: Record<string, { bg: string; color: string }> = {
    PREVIEW: { bg: "#eaf5fe", color: "#1f5199" },
    VALID: { bg: "#effaf5", color: "#0f5132" },
    INVALID: { bg: "#fff4f4", color: "#8a1f11" },
    IMPORTED: { bg: "#effaf5", color: "#0f5132" },
    COMPLETED: { bg: "#effaf5", color: "#0f5132" },
    PARTIAL: { bg: "#fff7ed", color: "#8a5a00" },
    FAILED: { bg: "#fff4f4", color: "#8a1f11" },
  };
  const c = colors[status] ?? { bg: "#f4f6f8", color: "#6d7175" };
  return {
    background: c.bg,
    color: c.color,
    padding: "3px 8px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: 650,
    display: "inline-block",
  } as const;
}

// Styles
const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "12px",
} as const;

const metricStyle = {
  border: "1px solid #dfe3e8",
  borderRadius: "8px",
  padding: "14px",
  background: "#fff",
} as const;

const metricValueStyle = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#202223",
} as const;

const mutedStyle = {
  color: "#6d7175",
  fontSize: "13px",
  marginTop: "4px",
} as const;

const bodyStyle = {
  margin: "0 0 14px",
  color: "#5c5f62",
} as const;

const fieldLabelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "13px",
  fontWeight: 600,
} as const;

const fileInputStyle = {
  border: "1px solid #c9cccf",
  borderRadius: "6px",
  padding: "8px 10px",
  fontSize: "14px",
  background: "#fff",
  width: "100%",
} as const;

const textareaStyle = {
  width: "100%",
  border: "1px solid #c9cccf",
  borderRadius: "6px",
  padding: "10px",
  font: "inherit",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  resize: "vertical",
} as const;

const selectStyle = {
  border: "1px solid #c9cccf",
  borderRadius: "6px",
  padding: "8px 10px",
  fontSize: "13px",
  background: "#fff",
  width: "100%",
  marginTop: "6px",
} as const;

const buttonStyle = {
  border: "1px solid #c9cccf",
  borderRadius: "6px",
  padding: "9px 16px",
  background: "#fff",
  color: "#202223",
  fontWeight: 650,
  cursor: "pointer",
} as const;

const secondaryBtnStyle = {
  border: "1px solid #c9cccf",
  borderRadius: "6px",
  padding: "8px 14px",
  background: "#fff",
  color: "#202223",
  fontWeight: 650,
  fontSize: "13px",
  textDecoration: "none",
  display: "inline-block",
} as const;

const primaryButtonStyle = {
  border: "0",
  borderRadius: "6px",
  padding: "10px 18px",
  background: "#008060",
  color: "#fff",
  fontWeight: 650,
  cursor: "pointer",
} as const;

const smallBtnStyle = {
  border: "1px solid #c9cccf",
  borderRadius: "4px",
  padding: "4px 8px",
  background: "#fff",
  cursor: "pointer",
  fontSize: "12px",
} as const;

const smallDangerLinkStyle = {
  border: "1px solid #e0b3b2",
  borderRadius: "4px",
  padding: "4px 8px",
  background: "#fff4f4",
  color: "#8a1f11",
  cursor: "pointer",
  fontSize: "12px",
  textDecoration: "none",
  display: "inline-block",
} as const;

const dangerOutlineBtnStyle = {
  border: "1px solid #e0b3b2",
  borderRadius: "6px",
  padding: "6px 12px",
  background: "#fff4f4",
  color: "#8a1f11",
  fontWeight: 650,
  fontSize: "13px",
  textDecoration: "none",
  display: "inline-block",
} as const;

const typeBadgeStyle = {
  display: "inline-block",
  background: "#f4f6f8",
  border: "1px solid #dfe3e8",
  borderRadius: "6px",
  padding: "6px 12px",
  fontSize: "13px",
  color: "#202223",
  marginBottom: "16px",
} as const;

const sampleBannerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
  padding: "14px 16px",
  background: "#f4f6f8",
  border: "1px solid #dfe3e8",
  borderRadius: "8px",
} as const;

const previewSummaryStyle = {
  display: "flex",
  gap: "24px",
  alignItems: "center",
  flexWrap: "wrap",
  background: "#f9fafb",
  padding: "12px 16px",
  borderRadius: "6px",
  border: "1px solid #e5e7eb",
  fontSize: "14px",
} as const;

const subHeadingStyle = {
  fontSize: "14px",
  fontWeight: 700,
  marginBottom: "8px",
  color: "#202223",
} as const;

const mappingGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "10px",
} as const;

const mappingCardStyle = {
  border: "1px solid #dfe3e8",
  borderRadius: "6px",
  padding: "10px",
  background: "#fff",
} as const;

const tableWrapStyle = {
  overflowX: "auto",
} as const;

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
} as const;

const thStyle = {
  textAlign: "left",
  borderBottom: "1px solid #dfe3e8",
  padding: "10px 8px",
  whiteSpace: "nowrap",
  background: "#f9fafb",
} as const;

const tdStyle = {
  borderBottom: "1px solid #f1f2f3",
  padding: "10px 8px",
  verticalAlign: "top",
} as const;

const noticeStyle = (ok: boolean) =>
  ({
    border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`,
    background: ok ? "#effaf5" : "#fff4f4",
    borderRadius: "8px",
    marginBottom: "12px",
    padding: "10px 12px",
    color: ok ? "#0f5132" : "#8a1f11",
  }) as const;


// Shopify requires ErrorBoundary on every route that calls authenticate.admin
// so that thrown 200/401 responses (App Bridge re-auth) are handled correctly.
export function ErrorBoundary() {
  const error = useRouteError();
  return boundary.error(error);
}
export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
