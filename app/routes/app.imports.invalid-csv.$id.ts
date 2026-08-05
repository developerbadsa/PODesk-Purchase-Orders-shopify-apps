import type { LoaderFunctionArgs } from "react-router";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "invalid-csv-loader");
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) throw new Response("Store not found", { status: 404 });

  const jobId = params.id;
  if (!jobId) throw new Response("Job ID required", { status: 400 });

  const importJob = await prisma.importJob.findFirst({
    where: { id: jobId, storeId: store.id },
    include: {
      rows: {
        where: {
          OR: [{ status: "INVALID" }, { errorMessage: { not: null } }],
        },
        orderBy: { rowNumber: "asc" },
      },
    },
  });

  if (!importJob) throw new Response("Import job not found", { status: 404 });
  if (importJob.rows.length === 0) {
    throw new Response("No invalid rows found in this import job", { status: 404 });
  }

  // Parse headers from originalHeaders or rawData keys
  let originalHeaders: string[] = [];
  if (importJob.originalHeaders) {
    try {
      originalHeaders = JSON.parse(importJob.originalHeaders) as string[];
    } catch {
      originalHeaders = [];
    }
  }

  if (originalHeaders.length === 0 && importJob.rows[0]) {
    try {
      const parsedData = JSON.parse(importJob.rows[0].rawData) as Record<string, string>;
      originalHeaders = Object.keys(parsedData);
    } catch {
      originalHeaders = ["rowNumber"];
    }
  }

  const csvHeaders = ["row_number", ...originalHeaders, "error_reason"];
  const csvLines: string[] = [csvHeaders.map(escapeCsvField).join(",")];

  for (const row of importJob.rows) {
    let rawDataObj: Record<string, string> = {};
    try {
      rawDataObj = JSON.parse(row.rawData) as Record<string, string>;
    } catch {
      rawDataObj = {};
    }

    const rowValues = originalHeaders.map((header) => rawDataObj[header] ?? "");
    const line = [
      escapeCsvField(row.rowNumber),
      ...rowValues.map(escapeCsvField),
      escapeCsvField(row.errorMessage || "Validation failed"),
    ].join(",");

    csvLines.push(line);
  }

  const csvContent = csvLines.join("\n");
  const filename = `invalid-rows-${importJob.id}.csv`;

  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
};
