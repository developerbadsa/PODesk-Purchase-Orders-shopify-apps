import { useState } from "react";
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
  useSearchParams,
  redirect,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";
import {
  calculateReorderRecommendation,
  getFinalSuggestedQuantity,
} from "../reorder.server";
import { SearchableSelect } from "../components/SearchableSelect";

const SALES_WINDOWS = [7, 14, 30, 90] as const;
const DEFAULT_BUFFER_DAYS = 3;
const DEFAULT_TARGET_DAYS = 30;
const PAGE_SIZE = 50;

type ActionData = { ok: boolean; message: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "reorder-loader");
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) {
    return {
      variants: [],
      suppliers: [],
      lastSyncAt: null,
      totalCount: 0,
      filteredCount: 0,
      page: 1,
      pageSize: PAGE_SIZE,
      riskCounts: { critical: 0, reorderSoon: 0, watch: 0, healthy: 0 },
    };
  }

  const url = new URL(request.url);
  const salesWindow = parseInt(url.searchParams.get("window") || "30", 10);
  const bufferDays = parseInt(url.searchParams.get("buffer") || String(DEFAULT_BUFFER_DAYS), 10);
  const targetDays = parseInt(url.searchParams.get("target") || String(DEFAULT_TARGET_DAYS), 10);
  const filterSupplier = url.searchParams.get("supplier") || "";
  const filterRisk = url.searchParams.get("risk") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));

  const supplierFilter = filterSupplier
    ? { supplierMappings: { some: { supplierId: filterSupplier, isPrimary: true } } }
    : {};

  const totalCount = await prisma.shopifyVariant.count({
    where: { storeId: store.id, tracked: true, ...supplierFilter },
  });

  const variants = await prisma.shopifyVariant.findMany({
    where: { storeId: store.id, tracked: true, ...supplierFilter },
    select: {
      id: true,
      title: true,
      sku: true,
      inventoryQuantity: true,
      unitsSold30Days: true,
      daysUntilStockout: true,
      product: { select: { title: true } },
      supplierMappings: {
        where: { isPrimary: true },
        select: {
          supplierId: true,
          supplierLeadTimeDays: true,
          supplier: { select: { name: true, leadTimeDays: true } },
        },
        take: 1,
      },
      reorderOverrides: {
        where: { storeId: store.id },
        select: { overrideQuantity: true, reason: true, notes: true },
        take: 1,
      },
    },
    orderBy: [{ daysUntilStockout: "asc" }, { unitsSold30Days: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const suppliers = await prisma.supplier.findMany({
    where: { storeId: store.id, isArchived: false },
    orderBy: { name: "asc" },
  });

  const reorderData = variants.map((v) => {
    const primaryMapping = v.supplierMappings[0] ?? null;
    const supplierName = primaryMapping?.supplier.name ?? null;
    const supplierId = primaryMapping?.supplierId ?? null;
    const supplierLeadTime = primaryMapping?.supplierLeadTimeDays ?? primaryMapping?.supplier.leadTimeDays ?? null;

    const calc = calculateReorderRecommendation({
      inventoryQuantity: v.inventoryQuantity,
      unitsSold30Days: v.unitsSold30Days,
      salesWindow,
      targetDays,
      bufferDays,
      supplierLeadTime,
      hasSupplier: Boolean(primaryMapping),
    });

    const activeOverride = v.reorderOverrides[0] ?? null;
    const overrideQuantity = activeOverride?.overrideQuantity ?? null;
    const overrideReason = activeOverride?.reason ?? null;
    const overrideNotes = activeOverride?.notes ?? null;
    const hasOverride = overrideQuantity !== null;

    const finalSuggestedQty = getFinalSuggestedQuantity(
      calc.suggestedQtyFormula,
      overrideQuantity
    );

    return {
      id: v.id,
      productTitle: v.product.title,
      variantTitle: v.title,
      sku: v.sku,
      inventoryQuantity: v.inventoryQuantity,
      unitsSoldInWindow: calc.unitsSoldInWindow,
      avgDailySales: calc.avgDailySales,
      daysLeft: calc.daysLeft,
      supplierName,
      supplierId,
      supplierLeadTime,
      risk: calc.risk,
      riskReason: calc.riskReason,
      suggestedQtyFormula: calc.suggestedQtyFormula,
      overrideQuantity,
      finalSuggestedQty,
      overrideReason,
      overrideNotes,
      hasOverride,
    };
  });

  const filtered = filterRisk
    ? reorderData.filter((v) => v.risk === filterRisk)
    : reorderData;

  const [criticalCount, reorderSoonCount, watchCount, healthyCount] = await Promise.all([
    prisma.shopifyVariant.count({
      where: {
        storeId: store.id,
        tracked: true,
        ...supplierFilter,
        daysUntilStockout: { lte: 7 },
        averageDailySales: { gt: 0 },
      },
    }),
    prisma.shopifyVariant.count({
      where: {
        storeId: store.id,
        tracked: true,
        ...supplierFilter,
        daysUntilStockout: { gt: 7, lte: 14 },
        averageDailySales: { gt: 0 },
      },
    }),
    prisma.shopifyVariant.count({
      where: {
        storeId: store.id,
        tracked: true,
        ...supplierFilter,
        daysUntilStockout: { gt: 14, lte: 30 },
        averageDailySales: { gt: 0 },
      },
    }),
    prisma.shopifyVariant.count({
      where: {
        storeId: store.id,
        tracked: true,
        ...supplierFilter,
        OR: [
          { daysUntilStockout: { gt: 30 } },
          { averageDailySales: { lte: 0 } },
        ],
      },
    }),
  ]);

  return {
    variants: filtered,
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
    lastSyncAt: store.lastSyncAt?.toISOString() ?? null,
    totalCount,
    filteredCount: filtered.length,
    page,
    pageSize: PAGE_SIZE,
    riskCounts: {
      critical: criticalCount,
      reorderSoon: reorderSoonCount,
      watch: watchCount,
      healthy: healthyCount,
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "reorder-action");
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) {
    return { ok: false, message: "Store not found." } satisfies ActionData;
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "save-override") {
    const variantId = String(formData.get("variantId") || "");
    const rawQty = formData.get("overrideQuantity");
    const notes = String(formData.get("notes") || "").trim();

    if (!variantId) {
      return { ok: false, message: "Invalid variant ID." } satisfies ActionData;
    }

    const parsedQty = rawQty !== null && rawQty !== "" ? Number(rawQty) : null;
    if (parsedQty !== null && (!Number.isInteger(parsedQty) || parsedQty < 0)) {
      return { ok: false, message: "Override quantity must be a non-negative integer." } satisfies ActionData;
    }

    if (parsedQty === null) {
      await prisma.reorderOverride.deleteMany({
        where: { storeId: store.id, variantId },
      });
      return { ok: true, message: "Override cleared successfully." } satisfies ActionData;
    }

    await prisma.reorderOverride.upsert({
      where: { storeId_variantId: { storeId: store.id, variantId } },
      create: {
        storeId: store.id,
        variantId,
        overrideQuantity: parsedQty,
        notes: notes || null,
        reason: "MANUAL_ADJUSTMENT",
      },
      update: {
        overrideQuantity: parsedQty,
        notes: notes || null,
        reason: "MANUAL_ADJUSTMENT",
      },
    });

    return { ok: true, message: "Reorder quantity override saved." } satisfies ActionData;
  }

  if (intent === "clear-override") {
    const variantId = String(formData.get("variantId") || "");
    if (!variantId) {
      return { ok: false, message: "Invalid variant ID." } satisfies ActionData;
    }

    await prisma.reorderOverride.deleteMany({
      where: { storeId: store.id, variantId },
    });

    return { ok: true, message: "Override cleared." } satisfies ActionData;
  }

  if (intent === "create-reorder-po") {
    const variantId = String(formData.get("variantId") || "");
    const supplierId = String(formData.get("supplierId") || "");
    const salesWindow = numberFromForm(formData.get("window"), 30);
    const bufferDays = numberFromForm(formData.get("buffer"), DEFAULT_BUFFER_DAYS);
    const targetDays = numberFromForm(formData.get("target"), DEFAULT_TARGET_DAYS);

    if (!variantId || !supplierId) {
      return { ok: false, message: "Missing variant or supplier for PO creation." } satisfies ActionData;
    }

    const mapping = await prisma.supplierVariantMapping.findFirst({
      where: { storeId: store.id, variantId, supplierId },
      include: {
        supplier: true,
        variant: {
          include: {
            reorderOverrides: { where: { storeId: store.id }, take: 1 },
          },
        },
      },
    });

    if (!mapping || mapping.supplier.isArchived) {
      return { ok: false, message: "Supplier mapping not found or supplier archived." } satisfies ActionData;
    }

    const supplierLeadTime = mapping.supplierLeadTimeDays ?? mapping.supplier.leadTimeDays;
    const calc = calculateReorderRecommendation({
      inventoryQuantity: mapping.variant.inventoryQuantity,
      unitsSold30Days: mapping.variant.unitsSold30Days,
      salesWindow,
      targetDays,
      bufferDays,
      supplierLeadTime,
      hasSupplier: true,
    });

    const quantity = getFinalSuggestedQuantity(
      calc.suggestedQtyFormula,
      mapping.variant.reorderOverrides[0]?.overrideQuantity ?? null,
    );

    if (!quantity || quantity <= 0) {
      return { ok: false, message: "This SKU does not have a positive final suggested reorder quantity." } satisfies ActionData;
    }

    const expectedArrival = new Date();
    expectedArrival.setDate(expectedArrival.getDate() + supplierLeadTime);

    const reference = `PO-${Date.now()}`;
    const newPo = await prisma.purchaseOrder.create({
      data: {
        storeId: store.id,
        supplierId,
        reference,
        expectedArrival,
        notes: "Created from reorder planning suggestion.",
        lines: {
          create: {
            variantId,
            quantity,
            unitCost: mapping.supplierCost ?? mapping.variant.unitCostAmount,
          },
        },
      },
    });

    return redirect(`/app/purchase-orders/${newPo.id}`);
  }

  if (intent === "create-multi-reorder-po") {
    const rawVariantIds = formData.getAll("variantIds").map(String);
    const variantIds = Array.from(new Set(rawVariantIds.filter(Boolean)));

    if (variantIds.length === 0) {
      return { ok: false, message: "Please select at least one reorder row to create a purchase order." } satisfies ActionData;
    }

    const salesWindow = numberFromForm(formData.get("window"), 30);
    const bufferDays = numberFromForm(formData.get("buffer"), DEFAULT_BUFFER_DAYS);
    const targetDays = numberFromForm(formData.get("target"), DEFAULT_TARGET_DAYS);

    const selectedVariants = await prisma.shopifyVariant.findMany({
      where: { storeId: store.id, id: { in: variantIds } },
      include: {
        product: true,
        supplierMappings: {
          where: { isPrimary: true },
          include: { supplier: true },
          take: 1,
        },
        reorderOverrides: {
          where: { storeId: store.id },
          take: 1,
        },
      },
    });

    if (selectedVariants.length !== variantIds.length) {
      return { ok: false, message: "One or more selected variants were not found in this store." } satisfies ActionData;
    }

    const supplierIds = new Set<string>();
    const lineItemsToCreate: Array<{ variantId: string; quantity: number; unitCost: number | null; leadTime: number }> = [];

    for (const v of selectedVariants) {
      const primaryMapping = v.supplierMappings[0] ?? null;
      if (!primaryMapping || primaryMapping.supplier.isArchived) {
        return { ok: false, message: `Variant "${v.product.title} (${v.title})" does not have an active mapped supplier.` } satisfies ActionData;
      }

      supplierIds.add(primaryMapping.supplierId);

      const supplierLeadTime = primaryMapping.supplierLeadTimeDays ?? primaryMapping.supplier.leadTimeDays;
      const calc = calculateReorderRecommendation({
        inventoryQuantity: v.inventoryQuantity,
        unitsSold30Days: v.unitsSold30Days,
        salesWindow,
        targetDays,
        bufferDays,
        supplierLeadTime,
        hasSupplier: true,
      });

      const activeOverride = v.reorderOverrides[0] ?? null;
      const finalSuggestedQty = getFinalSuggestedQuantity(calc.suggestedQtyFormula, activeOverride?.overrideQuantity ?? null);

      if (!finalSuggestedQty || finalSuggestedQty <= 0) {
        return { ok: false, message: `Variant "${v.product.title} (${v.title})" does not have a positive final suggested reorder quantity.` } satisfies ActionData;
      }

      const unitCost = primaryMapping.supplierCost ?? v.unitCostAmount;
      lineItemsToCreate.push({
        variantId: v.id,
        quantity: finalSuggestedQty,
        unitCost,
        leadTime: supplierLeadTime,
      });
    }

    if (supplierIds.size > 1) {
      return { ok: false, message: "All selected reorder rows must share the same supplier to create a single purchase order." } satisfies ActionData;
    }

    const supplierId = Array.from(supplierIds)[0];
    const maxLeadTime = Math.max(...lineItemsToCreate.map((l) => l.leadTime), 14);

    const expectedArrival = new Date();
    expectedArrival.setDate(expectedArrival.getDate() + maxLeadTime);

    const reference = `PO-${Date.now()}`;
    const newPo = await prisma.purchaseOrder.create({
      data: {
        storeId: store.id,
        supplierId,
        reference,
        expectedArrival,
        notes: `Created from reorder planning selection (${lineItemsToCreate.length} line items).`,
        lines: {
          create: lineItemsToCreate.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
        },
      },
    });

    return redirect(`/app/purchase-orders/${newPo.id}`);
  }

  return { ok: false, message: "Unknown action." } satisfies ActionData;
};

export default function ReorderPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const currentWindow = searchParams.get("window") || "30";
  const currentBuffer = searchParams.get("buffer") || String(DEFAULT_BUFFER_DAYS);
  const currentTarget = searchParams.get("target") || String(DEFAULT_TARGET_DAYS);
  const currentSupplier = searchParams.get("supplier") || "";
  const currentRisk = searchParams.get("risk") || "";

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  const selectableVariants = data.variants.filter(
    (v) => Boolean(v.supplierId) && Boolean(v.finalSuggestedQty) && v.finalSuggestedQty! > 0
  );

  const selectedVariantObjects = data.variants.filter((v) => selectedIds.includes(v.id));
  const selectedSuppliers = Array.from(new Set(selectedVariantObjects.map((v) => v.supplierName).filter(Boolean)));
  const hasMixedSuppliers = selectedSuppliers.length > 1;
  const sharedSupplierName = selectedSuppliers.length === 1 ? selectedSuppliers[0] : null;

  const isAllSelectableChecked =
    selectableVariants.length > 0 &&
    selectableVariants.every((v) => selectedIds.includes(v.id));

  function handleToggleAll() {
    if (isAllSelectableChecked) {
      setSelectedIds([]);
    } else {
      setSelectedIds(selectableVariants.map((v) => v.id));
    }
  }

  function handleToggleRow(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  return (
    <>
      <ui-title-bar title="Reorder Planning" />
      <div style={{ padding: "24px 32px", maxWidth: "1600px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {actionData?.message ? (
          <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
        ) : null}

        {/* Risk summary card */}
        <div style={sectionCardStyle}>
          <h2 style={cardHeaderStyle}>Risk Summary</h2>
          <div style={cardBodyStyle}>
            <div style={metricGridStyle}>
              <div style={riskMetric("#d72c0d")}>
                <div style={metricValueStyle}>{data.riskCounts.critical}</div>
                <div style={mutedStyle}>Critical</div>
              </div>
              <div style={riskMetric("#b98900")}>
                <div style={metricValueStyle}>{data.riskCounts.reorderSoon}</div>
                <div style={mutedStyle}>Reorder Soon</div>
              </div>
              <div style={riskMetric("#637381")}>
                <div style={metricValueStyle}>{data.riskCounts.watch}</div>
                <div style={mutedStyle}>Watch</div>
              </div>
              <div style={riskMetric("#008060")}>
                <div style={metricValueStyle}>{data.riskCounts.healthy}</div>
                <div style={mutedStyle}>Healthy</div>
              </div>
            </div>
            <div style={{ ...mutedStyle, marginTop: "12px" }}>
              Last sync: {data.lastSyncAt ? formatDateTime(data.lastSyncAt) : "Never synced"}
            </div>
          </div>
        </div>

        {/* Filters card */}
        <div style={sectionCardStyle}>
          <h2 style={cardHeaderStyle}>Filters & Configuration</h2>
          <div style={cardBodyStyle}>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "end", marginBottom: "20px" }}>
              <label style={{ ...fieldLabelStyle, minWidth: "220px", flex: "1 1 220px" }}>
                Sales window model
                <SearchableSelect
                  placeholder="Select sales window..."
                  value={currentWindow}
                  onChange={(val) => updateFilter("window", val)}
                  options={SALES_WINDOWS.map((w) => ({ value: String(w), label: `${w} days (velocity est.)` }))}
                />
              </label>
              <label style={{ ...fieldLabelStyle, width: "120px", flex: "0 0 120px" }}>
                Buffer days
                <input
                  type="number"
                  value={currentBuffer}
                  min="0"
                  onChange={(e) => updateFilter("buffer", e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={{ ...fieldLabelStyle, width: "140px", flex: "0 0 140px" }}>
                Target stock days
                <input
                  type="number"
                  value={currentTarget}
                  min="1"
                  onChange={(e) => updateFilter("target", e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={{ ...fieldLabelStyle, minWidth: "220px", flex: "1 1 220px" }}>
                Supplier
                <SearchableSelect
                  placeholder="All suppliers"
                  value={currentSupplier}
                  onChange={(val) => updateFilter("supplier", val)}
                  options={[
                    { value: "", label: "All suppliers" },
                    ...data.suppliers.map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
              </label>
              <label style={{ ...fieldLabelStyle, minWidth: "180px", flex: "1 1 180px" }}>
                Risk
                <SearchableSelect
                  placeholder="All risks"
                  value={currentRisk}
                  onChange={(val) => updateFilter("risk", val)}
                  options={[
                    { value: "", label: "All risks" },
                    { value: "Critical", label: "Critical" },
                    { value: "Reorder Soon", label: "Reorder Soon" },
                    { value: "Watch", label: "Watch" },
                    { value: "Healthy", label: "Healthy" },
                  ]}
                />
              </label>
            </div>

            <div style={formulaExplanationStyle}>
              <strong>Formula explanation:</strong> Suggested qty = target stock days x average daily sales - current stock. Lead time and buffer affect risk level. Manual overrides do not change Shopify inventory.
            </div>

            <div style={mutedStyle}>
              Showing {data.variants.length} of {data.totalCount} tracked variants
              {data.totalCount > data.pageSize ? ` (page ${data.page} of ${Math.ceil(data.totalCount / data.pageSize)})` : ""}
              . Sales figures for 7, 14, and 90 days are estimated from your synced 30-day sales velocity model.
            </div>
          </div>
        </div>

        {/* Reorder Table Card */}
        <div style={sectionCardStyle}>
          <h2 style={cardHeaderStyle}>Reorder Planning Table</h2>
          <div style={cardBodyStyle}>
            {/* BULK ACTION BAR */}
            {selectedIds.length > 0 && (
              <div style={bulkActionBarStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <strong>{selectedIds.length} item(s) selected</strong>
                  {sharedSupplierName ? (
                    <span style={supplierBadgeStyle}>Supplier: {sharedSupplierName}</span>
                  ) : hasMixedSuppliers ? (
                    <span style={warningBadgeStyle}>Mixed suppliers selected (Single supplier required)</span>
                  ) : null}
                </div>

                <Form method="post" style={{ display: "flex", gap: "8px" }}>
                  <input type="hidden" name="intent" value="create-multi-reorder-po" />
                  <input type="hidden" name="window" value={currentWindow} />
                  <input type="hidden" name="buffer" value={currentBuffer} />
                  <input type="hidden" name="target" value={currentTarget} />
                  {selectedIds.map((id) => (
                    <input key={id} type="hidden" name="variantIds" value={id} />
                  ))}
                  <button
                    type="submit"
                    disabled={isSubmitting || hasMixedSuppliers || selectedIds.length === 0}
                    style={hasMixedSuppliers ? disabledPrimaryBtnStyle : actionBtnStyle}
                  >
                    {isSubmitting ? "Creating PO..." : `Create draft PO from selected (${selectedIds.length})`}
                  </button>
                </Form>
              </div>
            )}

            {data.variants.length === 0 ? (
              <div style={emptyCardStyle}>
                <div style={{ fontWeight: 650, fontSize: "15px", marginBottom: "6px" }}>No variants match the current reorder view</div>
                <p style={{ margin: "0 0 12px", color: "#6d7175", fontSize: "13px" }}>
                  {data.totalCount === 0
                    ? "No tracked variants found in PODesk. Sync your inventory from the dashboard or create SKU mappings to calculate reorder suggestions."
                    : "Try adjusting your supplier or risk filters above to inspect other SKUs."}
                </p>
                {data.totalCount === 0 ? (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <Link to="/app" style={actionBtnStyle}>Go to Dashboard to Sync</Link>
                    <Link to="/app/mappings" style={secondaryLinkBtnStyle}>Map SKUs</Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: "40px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={isAllSelectableChecked}
                          onChange={handleToggleAll}
                          disabled={selectableVariants.length === 0}
                          title="Select all eligible rows for bulk PO"
                        />
                      </th>
                      <th style={{ ...thStyle, minWidth: "180px" }}>Product</th>
                      <th style={{ ...thStyle, width: "90px" }}>SKU</th>
                      <th style={{ ...thStyle, width: "80px", textAlign: "right" }}>Stock</th>
                      <th style={{ ...thStyle, width: "110px", textAlign: "right" }}>Est. sold ({currentWindow}d)</th>
                      <th style={{ ...thStyle, width: "80px", textAlign: "right" }}>Avg/day</th>
                      <th style={{ ...thStyle, width: "90px", textAlign: "right" }}>Days left</th>
                      <th style={{ ...thStyle, minWidth: "130px" }}>Supplier</th>
                      <th style={{ ...thStyle, width: "70px", textAlign: "right" }}>Lead</th>
                      <th style={{ ...thStyle, minWidth: "150px" }}>Reason</th>
                      <th style={{ ...thStyle, width: "100px", textAlign: "right" }}>Formula qty</th>
                      <th style={{ ...thStyle, width: "100px", textAlign: "right" }}>Final qty</th>
                      <th style={{ ...thStyle, width: "210px" }}>Override</th>
                      <th style={{ ...thStyle, width: "130px", textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.variants.map((v) => {
                      const isSelectable = Boolean(v.supplierId) && Boolean(v.finalSuggestedQty) && v.finalSuggestedQty! > 0;
                      const isChecked = selectedIds.includes(v.id);

                      return (
                        <tr key={v.id} style={{ background: isChecked ? "#f0f7ff" : "inherit" }}>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleRow(v.id)}
                              disabled={!isSelectable}
                              title={isSelectable ? "Select for draft PO" : "Requires mapped supplier & final suggested qty > 0"}
                            />
                          </td>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 650, color: "#111827" }}>{v.productTitle}</div>
                            <div style={{ color: "#6b7280", fontSize: "12px" }}>{v.variantTitle}</div>
                          </td>
                          <td style={tdStyle}>{v.sku || "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{v.inventoryQuantity}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{v.unitsSoldInWindow}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{v.avgDailySales}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{v.daysLeft != null ? v.daysLeft : "-"}</td>
                          <td style={tdStyle}>
                            {v.supplierName ? (
                              <Link to={`/app/suppliers/${v.supplierId}`} style={linkStyle}>{v.supplierName}</Link>
                            ) : (
                              <span style={{ color: "#9ca3af", fontSize: "13px" }}>Unmapped</span>
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{v.supplierLeadTime != null ? `${v.supplierLeadTime}d` : "-"}</td>
                          <td style={tdStyle}>
                            <span style={riskBadge(v.risk)}>{v.risk}</span>
                            <div style={riskReasonSubtextStyle}>{v.riskReason}</div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{v.suggestedQtyFormula != null ? v.suggestedQtyFormula : "-"}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: v.hasOverride ? 700 : 400 }}>
                            {v.finalSuggestedQty != null ? (
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                                <span>{v.finalSuggestedQty}</span>
                                {v.hasOverride ? (
                                  <span style={overrideBadgeStyle}>Manual override</span>
                                ) : null}
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <Form method="post" style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                <input type="hidden" name="intent" value="save-override" />
                                <input type="hidden" name="variantId" value={v.id} />
                                <input
                                  type="number"
                                  name="overrideQuantity"
                                  defaultValue={v.overrideQuantity != null ? v.overrideQuantity : ""}
                                  placeholder="Qty"
                                  min="0"
                                  style={overrideInputStyle}
                                />
                                <input
                                  type="text"
                                  name="notes"
                                  defaultValue={v.overrideNotes || ""}
                                  maxLength={300}
                                  placeholder="Reason"
                                  style={overrideReasonInputStyle}
                                />
                                <button type="submit" disabled={isSubmitting} style={smallBtnStyle}>
                                  Save
                                </button>
                              </Form>
                              {v.hasOverride ? (
                                <Form method="post" style={{ marginTop: "2px" }}>
                                  <input type="hidden" name="intent" value="clear-override" />
                                  <input type="hidden" name="variantId" value={v.id} />
                                  <button type="submit" disabled={isSubmitting} style={clearBtnStyle}>
                                    Clear override
                                  </button>
                                </Form>
                              ) : null}
                            </div>
                          </td>
                          <td style={tdStyle}>
                            {v.supplierId && v.finalSuggestedQty && v.finalSuggestedQty > 0 ? (
                              <Form method="post">
                                <input type="hidden" name="intent" value="create-reorder-po" />
                                <input type="hidden" name="variantId" value={v.id} />
                                <input type="hidden" name="supplierId" value={v.supplierId} />
                                <input type="hidden" name="window" value={currentWindow} />
                                <input type="hidden" name="buffer" value={currentBuffer} />
                                <input type="hidden" name="target" value={currentTarget} />
                                <button type="submit" disabled={isSubmitting} style={actionBtnStyle}>
                                  Create draft PO
                                </button>
                              </Form>
                            ) : !v.supplierId ? (
                              <Link to="/app/mappings" style={{ ...linkStyle, fontSize: "12px" }}>Map supplier</Link>
                            ) : v.avgDailySales === 0 ? (
                              <span style={{ color: "#6b7280", fontSize: "12px" }}>No recent sales</span>
                            ) : (
                              <span style={{ color: "#6b7280", fontSize: "12px" }}>Stock OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination controls */}
            {data.totalCount > data.pageSize && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px", padding: "12px 0", borderTop: "1px solid #e1e3e5" }}>
                <div style={{ color: "#6d7175", fontSize: "13px" }}>
                  Page {data.page} of {Math.ceil(data.totalCount / data.pageSize)} &nbsp;·&nbsp; {data.totalCount} total variants
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    disabled={data.page <= 1}
                    onClick={() => {
                      const p = new URLSearchParams(searchParams);
                      p.set("page", String(data.page - 1));
                      setSearchParams(p);
                    }}
                    style={{ padding: "6px 14px", border: "1px solid #c9cccf", borderRadius: "6px", background: data.page <= 1 ? "#f6f6f7" : "#fff", color: data.page <= 1 ? "#8c9196" : "#202223", cursor: data.page <= 1 ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 550 }}
                  >
                    ← Previous
                  </button>
                  <button
                    disabled={data.page >= Math.ceil(data.totalCount / data.pageSize)}
                    onClick={() => {
                      const p = new URLSearchParams(searchParams);
                      p.set("page", String(data.page + 1));
                      setSearchParams(p);
                    }}
                    style={{ padding: "6px 14px", border: "1px solid #c9cccf", borderRadius: "6px", background: data.page >= Math.ceil(data.totalCount / data.pageSize) ? "#f6f6f7" : "#fff", color: data.page >= Math.ceil(data.totalCount / data.pageSize) ? "#8c9196" : "#202223", cursor: data.page >= Math.ceil(data.totalCount / data.pageSize) ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 550 }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function numberFromForm(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function riskBadge(risk: string) {
  const colors: Record<string, { bg: string; color: string }> = {
    Critical: { bg: "#fff4f4", color: "#d72c0d" },
    "Reorder Soon": { bg: "#fff7ed", color: "#b98900" },
    Watch: { bg: "#f4f6f8", color: "#637381" },
    Healthy: { bg: "#effaf5", color: "#008060" },
  };
  const c = colors[risk] ?? { bg: "#f4f6f8", color: "#637381" };
  return { background: c.bg, color: c.color, padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", display: "inline-block" } as const;
}

// Styles
const sectionCardStyle = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "16px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)", marginBottom: "24px", overflow: "hidden", width: "100%", boxSizing: "border-box" } as const;
const cardHeaderStyle = { margin: 0, padding: "16px 24px", fontSize: "16px", fontWeight: 700, color: "#111827", borderBottom: "1px solid #f3f4f6", backgroundColor: "#f9fafb" } as const;
const cardBodyStyle = { padding: "24px" } as const;
const metricGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", marginBottom: "8px" } as const;
const riskMetric = (borderColor: string) => ({ border: `2px solid ${borderColor}`, borderRadius: "8px", padding: "14px", background: "#fff" }) as const;
const metricValueStyle = { fontSize: "24px", fontWeight: 700, color: "#202223" } as const;
const mutedStyle = { color: "#6d7175", fontSize: "13px", marginTop: "4px" } as const;
const fieldLabelStyle = { display: "grid", gap: "6px", color: "#202223", fontSize: "13px", fontWeight: 600 } as const;
const inputStyle = { height: "42px", minHeight: "42px", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: "8px", padding: "0 14px", fontSize: "14px", width: "100%", outline: "none", backgroundColor: "#ffffff", color: "#202223" } as const;
const linkStyle = { color: "#2c6ecb", textDecoration: "none" } as const;
const smallBtnStyle = { border: "1px solid #c9cccf", borderRadius: "4px", padding: "4px 8px", background: "#fff", cursor: "pointer", fontSize: "12px", whiteSpace: "nowrap" } as const;
const clearBtnStyle = { border: "none", background: "none", color: "#d72c0d", cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: "0" } as const;
const actionBtnStyle = { border: "1px solid #008060", borderRadius: "4px", padding: "6px 12px", background: "#008060", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", textDecoration: "none", display: "inline-block" } as const;
const secondaryLinkBtnStyle = { border: "1px solid #c9cccf", borderRadius: "4px", padding: "6px 12px", background: "#fff", color: "#202223", cursor: "pointer", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", textDecoration: "none", display: "inline-block" } as const;
const disabledPrimaryBtnStyle = { border: "1px solid #8c9196", borderRadius: "4px", padding: "6px 12px", background: "#8c9196", color: "#fff", cursor: "not-allowed", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" } as const;
const overrideInputStyle = { width: "65px", border: "1px solid #d1d5db", borderRadius: "6px", padding: "6px 8px", fontSize: "13px", outline: "none" } as const;
const overrideReasonInputStyle = { width: "120px", border: "1px solid #d1d5db", borderRadius: "6px", padding: "6px 8px", fontSize: "13px", outline: "none" } as const;
const overrideBadgeStyle = { background: "#f3f4f6", color: "#374151", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap" } as const;
const riskReasonSubtextStyle = { fontSize: "11px", color: "#6b7280", marginTop: "3px", whiteSpace: "nowrap" } as const;
const formulaExplanationStyle = { marginBottom: "16px", padding: "12px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", color: "#374151", fontSize: "13px", lineHeight: "1.5" } as const;
const bulkActionBarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", padding: "12px 16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", marginBottom: "16px", fontSize: "14px", color: "#166534" } as const;
const supplierBadgeStyle = { background: "#fff", color: "#166534", padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, border: "1px solid #bbf7d0" } as const;
const warningBadgeStyle = { background: "#fff4f4", color: "#dc2626", padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, border: "1px solid #fca5a5" } as const;
const emptyCardStyle = { padding: "24px", background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px", textAlign: "left" } as const;
const tableWrapStyle = { overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "12px", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" } as const;
const tableStyle = { width: "100%", borderCollapse: "separate", borderSpacing: "0", fontSize: "14px" } as const;
const thStyle = { textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "14px 12px", whiteSpace: "nowrap", backgroundColor: "#f9fafb", color: "#4b5563", fontSize: "13px", fontWeight: 650 } as const;
const tdStyle = { borderBottom: "1px solid #f3f4f6", padding: "14px 12px", verticalAlign: "middle", color: "#111827" } as const;
const noticeStyle = (ok: boolean) => ({ border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`, background: ok ? "#effaf5" : "#fff4f4", borderRadius: "8px", marginTop: "12px", marginBottom: "12px", padding: "10px 12px", color: ok ? "#0f5132" : "#8a1f11" }) as const;

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
