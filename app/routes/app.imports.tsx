import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

type ActionData = {
  ok: boolean;
  message: string;
  details?: string[];
};

const SAMPLE_CSV = `name,email,phone,leadTimeDays,paymentTerms,minimumOrder,notes
Acme Wholesale,buying@acme.test,+1 555 0100,14,Net 30,500,Main apparel supplier
North Supply,orders@north.test,+1 555 0101,21,Prepaid,250,Backup supplier`;

const MAX_CSV_CHARACTERS = 200_000;
const MAX_CSV_ROWS = 500;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) return { supplierCount: 0, mappingCount: 0, purchaseOrderCount: 0 };

  const [supplierCount, mappingCount, purchaseOrderCount] = await Promise.all([
    prisma.supplier.count({ where: { storeId: store.id } }),
    prisma.supplierVariantMapping.count({ where: { storeId: store.id } }),
    prisma.purchaseOrder.count({ where: { storeId: store.id } }),
  ]);

  return { supplierCount, mappingCount, purchaseOrderCount };
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

  if (intent !== "import-suppliers") {
    return { ok: false, message: "Unknown action." } satisfies ActionData;
  }

  const csv = String(formData.get("csv") || "").trim();
  if (!csv) {
    return { ok: false, message: "Paste supplier CSV before importing." } satisfies ActionData;
  }

  if (csv.length > MAX_CSV_CHARACTERS) {
    return {
      ok: false,
      message: `CSV text is too large (${csv.length.toLocaleString()} characters). Limit is ${MAX_CSV_CHARACTERS.toLocaleString()} characters.`,
    } satisfies ActionData;
  }

  try {
    const rows = parseCsv(csv);
    if (rows.length === 0) {
      return { ok: false, message: "CSV has no valid data rows or header line." } satisfies ActionData;
    }

    if (rows.length > MAX_CSV_ROWS) {
      return {
        ok: false,
        message: `CSV contains too many rows (${rows.length} rows). Limit is ${MAX_CSV_ROWS} rows per import.`,
      } satisfies ActionData;
    }

    const requiredColumns = ["name"];
    const missingColumns = requiredColumns.filter((column) => !(column in rows[0]));
    if (missingColumns.length > 0) {
      const foundHeaders = Object.keys(rows[0]).join(", ");
      return {
        ok: false,
        message: `CSV is missing required column: ${missingColumns.join(", ")}. Found headers: ${foundHeaders || "none"}`,
      } satisfies ActionData;
    }

    const existingSuppliers = await prisma.supplier.findMany({
      where: { storeId: store.id },
      select: { id: true, name: true },
    });
    const existingByName = new Map(
      existingSuppliers.map((supplier) => [supplier.name.trim().toLowerCase(), supplier]),
    );

    let created = 0;
    let updated = 0;
    const skipped: string[] = [];

    for (const [index, row] of rows.entries()) {
      const name = clean(row.name);
      if (!name) {
        skipped.push(`Row ${index + 2}: missing supplier name`);
        continue;
      }

      const data = {
        name,
        email: optionalString(row.email),
        phone: optionalString(row.phone),
        leadTimeDays: optionalInteger(row.leadTimeDays) ?? 14,
        minimumOrder: optionalInteger(row.minimumOrder),
        paymentTerms: optionalString(row.paymentTerms),
        notes: optionalString(row.notes),
        isArchived: false,
      };

      const existing = existingByName.get(name.toLowerCase());
      if (existing) {
        await prisma.supplier.update({
          where: { id: existing.id },
          data,
        });
        updated += 1;
      } else {
        const supplier = await prisma.supplier.create({
          data: { storeId: store.id, ...data },
        });
        existingByName.set(name.toLowerCase(), supplier);
        created += 1;
      }
    }

    return {
      ok: true,
      message: `Supplier import complete. Created ${created}, updated ${updated}, skipped ${skipped.length}.`,
      details: skipped.slice(0, 8),
    } satisfies ActionData;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Import failed: ${message}` } satisfies ActionData;
  }
};

export default function ImportsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page heading="Stocky import">
      {actionData?.message ? (
        <div style={noticeStyle(actionData.ok)}>
          <div>{actionData.message}</div>
          {actionData.details && actionData.details.length > 0 ? (
            <ul style={detailListStyle}>
              {actionData.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <s-section heading="Migration status">
        <div style={metricGridStyle}>
          <Metric label="Suppliers" value={data.supplierCount} />
          <Metric label="SKU mappings" value={data.mappingCount} />
          <Metric label="Purchase orders" value={data.purchaseOrderCount} />
        </div>
      </s-section>

      <s-section heading="Import suppliers from CSV">
        <p style={bodyStyle}>
          Paste a supplier export from Stocky, spreadsheet, or another purchasing
          tool. PODesk currently imports supplier records only. SKU mapping and PO
          archive imports stay separate so bad data cannot damage the workflow.
        </p>
        <Form method="post">
          <input type="hidden" name="intent" value="import-suppliers" />
          <label style={fieldLabelStyle}>
            Supplier CSV
            <textarea
              name="csv"
              rows={10}
              placeholder={SAMPLE_CSV}
              style={textareaStyle}
            />
          </label>
          <button type="submit" disabled={isSubmitting} style={buttonStyle}>
            {isSubmitting ? "Importing..." : "Import suppliers"}
          </button>
        </Form>
      </s-section>

      <s-section heading="Required columns">
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Column</th>
                <th style={thStyle}>Required</th>
                <th style={thStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              <Column name="name" required notes="Supplier company name. Used to detect duplicates." />
              <Column name="email" notes="Purchasing or orders email." />
              <Column name="phone" notes="Optional supplier phone." />
              <Column name="leadTimeDays" notes="Defaults to 14 when blank or invalid." />
              <Column name="paymentTerms" notes="Example: Net 30, Prepaid, COD." />
              <Column name="minimumOrder" notes="Whole number minimum order amount or units." />
              <Column name="notes" notes="Internal operations notes." />
            </tbody>
          </table>
        </div>
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

function Column({
  name,
  required = false,
  notes,
}: {
  name: string;
  required?: boolean;
  notes: string;
}) {
  return (
    <tr>
      <td style={tdStyle}><code>{name}</code></td>
      <td style={tdStyle}>{required ? "Yes" : "No"}</td>
      <td style={tdStyle}>{notes}</td>
    </tr>
  );
}

function normalizeHeader(raw: string): string {
  const clean = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (clean === "name" || clean === "suppliername" || clean === "company") return "name";
  if (clean === "email" || clean === "supplieremail") return "email";
  if (clean === "phone" || clean === "telephone" || clean === "mobile") return "phone";
  if (clean === "leadtimedays" || clean === "leadtime" || clean === "leadtimeindays") return "leadTimeDays";
  if (clean === "paymentterms" || clean === "terms" || clean === "payterms") return "paymentTerms";
  if (clean === "minimumorder" || clean === "moq" || clean === "minorder" || clean === "minimumorderquantity") return "minimumOrder";
  if (clean === "notes" || clean === "note" || clean === "comments") return "notes";
  return raw.trim();
}

function parseCsv(csv: string) {
  const rows = parseCsvRows(csv);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => normalizeHeader(header));
  return rows.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current.trim());
      current = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

function clean(value: string | undefined) {
  return String(value || "").trim();
}

function optionalString(value: string | undefined) {
  const text = clean(value);
  return text.length > 0 ? text : null;
}

function optionalInteger(value: string | undefined) {
  const parsed = parseInt(clean(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
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
  marginBottom: "12px",
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

const buttonStyle = {
  border: "0",
  borderRadius: "6px",
  padding: "10px 14px",
  background: "#008060",
  color: "#fff",
  fontWeight: 650,
  cursor: "pointer",
} as const;

const detailListStyle = {
  margin: "8px 0 0",
  paddingLeft: "20px",
} as const;

const tableWrapStyle = {
  overflowX: "auto",
} as const;

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "14px",
} as const;

const thStyle = {
  textAlign: "left",
  borderBottom: "1px solid #dfe3e8",
  padding: "10px 8px",
  whiteSpace: "nowrap",
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

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
