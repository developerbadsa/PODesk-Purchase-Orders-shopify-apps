import prisma from "./db.server";
import {
  FIELD_DEFINITIONS,
  TARGET_FIELDS,
  type TargetField,
} from "./utils";

export { FIELD_DEFINITIONS, TARGET_FIELDS, type TargetField };

export function normalizeHeaderKey(rawHeader: string): string {
  return rawHeader.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function autoDetectField(rawHeader: string): TargetField | null {
  const key = normalizeHeaderKey(rawHeader);
  if (["sku", "productsku", "variantsku", "itemsku", "itemnumber"].includes(key)) {
    return "sku";
  }
  if (
    ["supplier", "suppliername", "vendor", "vendorname", "company", "companyname"].includes(
      key
    )
  ) {
    return "supplierName";
  }
  if (
    [
      "suppliersku",
      "vendorsku",
      "partnumber",
      "supplierpartnumber",
      "mfgpartnumber",
    ].includes(key)
  ) {
    return "supplierSku";
  }
  if (
    [
      "cost",
      "unitcost",
      "suppliercost",
      "vendorcost",
      "costprice",
      "price",
    ].includes(key)
  ) {
    return "supplierCost";
  }
  if (["leadtime", "leadtimedays", "leadtimeindays", "lead"].includes(key)) {
    return "leadTimeDays";
  }
  if (["paymentterms", "terms", "payterms", "paymentterm"].includes(key)) {
    return "paymentTerms";
  }
  if (
    [
      "minimumorder",
      "moq",
      "minorder",
      "minimumorderquantity",
    ].includes(key)
  ) {
    return "minimumOrder";
  }
  if (["notes", "note", "comments", "comment", "description"].includes(key)) {
    return "notes";
  }
  return null;
}

export function parseRawCsvMatrix(csvContent: string): string[][] {
  if (csvContent.length > 1_048_576) {
    throw new Error("CSV exceeds maximum allowed file size of 1 MB.");
  }

  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csvContent.length; i++) {
    const char = csvContent[i];
    const next = csvContent[i + 1];

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
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  if (rows.length < 2) {
    throw new Error("CSV contains no data rows or header line.");
  }

  if (rows.length > 1001) {
    throw new Error(
      `CSV exceeds maximum allowed limit of 1,000 data rows (found ${rows.length - 1} rows).`
    );
  }

  return rows;
}

export function buildDetectedMapping(
  headers: string[]
): Record<TargetField, string> {
  const mapping: Record<TargetField, string> = {
    sku: "",
    supplierName: "",
    supplierSku: "",
    supplierCost: "",
    leadTimeDays: "",
    paymentTerms: "",
    minimumOrder: "",
    notes: "",
  };

  headers.forEach((header) => {
    const field = autoDetectField(header);
    if (field && !mapping[field]) {
      mapping[field] = header;
    }
  });

  return mapping;
}

export async function createImportPreview(
  storeId: string,
  filename: string,
  csvContent: string,
  customMapping?: Record<TargetField, string>
) {
  const matrix = parseRawCsvMatrix(csvContent);
  const headers = matrix[0].map((h) => h.trim());
  const dataRows = matrix.slice(1);

  const detectedMapping = customMapping || buildDetectedMapping(headers);

  // Fetch store's synced Shopify variants
  const storeVariants = await prisma.shopifyVariant.findMany({
    where: { storeId },
    select: { id: true, sku: true },
  });
  const variantBySku = new Map<string, string>();
  storeVariants.forEach((v) => {
    if (v.sku) {
      variantBySku.set(v.sku.trim().toLowerCase(), v.id);
    }
  });

  let validCount = 0;
  let invalidCount = 0;

  const jobRowsData: Array<{
    rowNumber: number;
    rawData: string;
    normalizedData: string;
    status: "VALID" | "INVALID";
    errorMessage: string | null;
  }> = [];

  dataRows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const rawDataRecord: Record<string, string> = {};
    headers.forEach((h, i) => {
      rawDataRecord[h] = cells[i] ?? "";
    });

    const getValue = (field: TargetField): string => {
      const headerName = detectedMapping[field];
      if (!headerName) return "";
      const headerIdx = headers.indexOf(headerName);
      if (headerIdx === -1) return "";
      return (cells[headerIdx] ?? "").trim();
    };

    const sku = getValue("sku");
    const supplierName = getValue("supplierName");
    const supplierSku = getValue("supplierSku") || sku;
    const costStr = getValue("supplierCost");
    const leadTimeStr = getValue("leadTimeDays");
    const paymentTerms = getValue("paymentTerms");
    const minimumOrderStr = getValue("minimumOrder");
    const notes = getValue("notes");

    const errors: string[] = [];

    if (!sku) {
      errors.push("SKU is required.");
    } else if (!variantBySku.has(sku.toLowerCase())) {
      errors.push(`Variant with SKU '${sku}' not found in store.`);
    }

    if (!supplierName) {
      errors.push("Supplier name is required.");
    }

    let parsedCost: number | null = null;
    if (costStr) {
      const num = Number(costStr);
      if (!Number.isFinite(num) || num < 0) {
        errors.push("Supplier cost must be a non-negative number.");
      } else {
        parsedCost = num;
      }
    }

    let parsedLeadTime: number | null = null;
    if (leadTimeStr) {
      const num = parseInt(leadTimeStr, 10);
      if (!Number.isFinite(num) || num < 0) {
        errors.push("Lead time must be a non-negative integer.");
      } else {
        parsedLeadTime = num;
      }
    }

    let parsedMinOrder: number | null = null;
    if (minimumOrderStr) {
      const num = parseInt(minimumOrderStr, 10);
      if (!Number.isFinite(num) || num < 0) {
        errors.push("Minimum order must be a non-negative integer.");
      } else {
        parsedMinOrder = num;
      }
    }

    const isValid = errors.length === 0;
    if (isValid) {
      validCount += 1;
    } else {
      invalidCount += 1;
    }

    const normalizedRecord = {
      sku,
      supplierName,
      supplierSku,
      supplierCost: parsedCost,
      leadTimeDays: parsedLeadTime,
      paymentTerms: paymentTerms || null,
      minimumOrder: parsedMinOrder,
      notes: notes || null,
    };

    jobRowsData.push({
      rowNumber,
      rawData: JSON.stringify(rawDataRecord),
      normalizedData: JSON.stringify(normalizedRecord),
      status: isValid ? "VALID" : "INVALID",
      errorMessage: errors.length > 0 ? errors.join(" ") : null,
    });
  });

  const importJob = await prisma.importJob.create({
    data: {
      storeId,
      type: "SUPPLIER_MAPPINGS",
      status: "PREVIEW",
      filename,
      originalHeaders: JSON.stringify(headers),
      detectedMapping: JSON.stringify(detectedMapping),
      totalRows: dataRows.length,
      validRows: validCount,
      invalidRows: invalidCount,
      importedSuppliers: 0,
      importedMappings: 0,
      rows: {
        create: jobRowsData,
      },
    },
    include: {
      rows: {
        orderBy: { rowNumber: "asc" },
      },
    },
  });

  return importJob;
}

export async function executeImportJob(storeId: string, importJobId: string) {
  const job = await prisma.importJob.findFirst({
    where: { id: importJobId, storeId },
    include: {
      rows: {
        orderBy: { rowNumber: "asc" },
      },
    },
  });

  if (!job) {
    throw new Error("Import job not found.");
  }

  if (job.status === "COMPLETED") {
    throw new Error("This import job has already been completed.");
  }

  // Fetch store variants & existing suppliers
  const storeVariants = await prisma.shopifyVariant.findMany({
    where: { storeId },
    select: { id: true, sku: true },
  });
  const variantBySku = new Map<string, string>();
  storeVariants.forEach((v) => {
    if (v.sku) variantBySku.set(v.sku.trim().toLowerCase(), v.id);
  });

  const existingSuppliers = await prisma.supplier.findMany({
    where: { storeId },
  });
  const supplierByName = new Map<string, typeof existingSuppliers[number]>();
  existingSuppliers.forEach((s) => {
    supplierByName.set(s.name.trim().toLowerCase(), s);
  });

  let createdSuppliersCount = 0;
  let importedMappingsCount = 0;

  for (const row of job.rows) {
    if (row.status !== "VALID" || !row.normalizedData) {
      continue;
    }

    try {
      const data = JSON.parse(row.normalizedData) as {
        sku: string;
        supplierName: string;
        supplierSku: string | null;
        supplierCost: number | null;
        leadTimeDays: number | null;
        paymentTerms: string | null;
        minimumOrder: number | null;
        notes: string | null;
      };

      const variantId = variantBySku.get(data.sku.trim().toLowerCase());
      if (!variantId) {
        await prisma.importJobRow.update({
          where: { id: row.id },
          data: { status: "FAILED", errorMessage: `Variant SKU '${data.sku}' no longer exists.` },
        });
        continue;
      }

      // Find or create supplier
      const sNameKey = data.supplierName.trim().toLowerCase();
      let supplier = supplierByName.get(sNameKey);

      if (!supplier) {
        supplier = await prisma.supplier.create({
          data: {
            storeId,
            name: data.supplierName.trim(),
            leadTimeDays: data.leadTimeDays ?? 14,
            minimumOrder: data.minimumOrder,
            paymentTerms: data.paymentTerms,
            notes: data.notes,
          },
        });
        supplierByName.set(sNameKey, supplier);
        createdSuppliersCount += 1;
      } else {
        // Update existing supplier optional fields only if currently blank
        const updateData: Record<string, unknown> = {};
        if (!supplier.paymentTerms && data.paymentTerms) {
          updateData.paymentTerms = data.paymentTerms;
        }
        if (!supplier.notes && data.notes) {
          updateData.notes = data.notes;
        }
        if (supplier.minimumOrder == null && data.minimumOrder != null) {
          updateData.minimumOrder = data.minimumOrder;
        }

        if (Object.keys(updateData).length > 0) {
          supplier = await prisma.supplier.update({
            where: { id: supplier.id },
            data: updateData,
          });
          supplierByName.set(sNameKey, supplier);
        }
      }

      // Create or update SupplierVariantMapping
      const existingMapping = await prisma.supplierVariantMapping.findUnique({
        where: {
          supplierId_variantId: {
            supplierId: supplier.id,
            variantId,
          },
        },
      });

      const existingPrimaryCount = await prisma.supplierVariantMapping.count({
        where: { storeId, variantId, isPrimary: true },
      });
      const shouldBePrimary = existingPrimaryCount === 0 || (existingMapping ? existingMapping.isPrimary : false);

      if (existingMapping) {
        await prisma.supplierVariantMapping.update({
          where: { id: existingMapping.id },
          data: {
            supplierSku: data.supplierSku || data.sku,
            supplierCost: data.supplierCost ?? existingMapping.supplierCost,
            supplierLeadTimeDays: data.leadTimeDays ?? existingMapping.supplierLeadTimeDays,
            isPrimary: shouldBePrimary,
          },
        });
      } else {
        await prisma.supplierVariantMapping.create({
          data: {
            storeId,
            supplierId: supplier.id,
            variantId,
            supplierSku: data.supplierSku || data.sku,
            supplierCost: data.supplierCost,
            supplierLeadTimeDays: data.leadTimeDays,
            isPrimary: shouldBePrimary,
          },
        });
      }

      importedMappingsCount += 1;

      await prisma.importJobRow.update({
        where: { id: row.id },
        data: { status: "IMPORTED" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.importJobRow.update({
        where: { id: row.id },
        data: { status: "FAILED", errorMessage: msg },
      });
    }
  }

  const updatedJob = await prisma.importJob.update({
    where: { id: importJobId },
    data: {
      status: job.invalidRows === 0 ? "COMPLETED" : "PARTIAL",
      importedSuppliers: createdSuppliersCount,
      importedMappings: importedMappingsCount,
    },
    include: {
      rows: { orderBy: { rowNumber: "asc" } },
    },
  });

  return updatedJob;
}
