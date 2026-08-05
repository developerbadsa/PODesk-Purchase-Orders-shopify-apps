import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, useSearchParams, redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";
import {
  calculateReorderRecommendation,
  getFinalSuggestedQuantity,
} from "../reorder.server";

const SALES_WINDOWS = [7, 14, 30, 90] as const;
const DEFAULT_BUFFER_DAYS = 3;
const DEFAULT_TARGET_DAYS = 30;

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
      riskCounts: { critical: 0, reorderSoon: 0, watch: 0, healthy: 0 },
    };
  }

  const url = new URL(request.url);
  const salesWindow = parseInt(url.searchParams.get("window") || "30", 10);
  const bufferDays = parseInt(url.searchParams.get("buffer") || String(DEFAULT_BUFFER_DAYS), 10);
  const targetDays = parseInt(url.searchParams.get("target") || String(DEFAULT_TARGET_DAYS), 10);
  const filterSupplier = url.searchParams.get("supplier") || "";
  const filterRisk = url.searchParams.get("risk") || "";

  // Get all tracked variants with primary supplier mappings and saved reorder overrides
  const variants = await prisma.shopifyVariant.findMany({
    where: { storeId: store.id, tracked: true },
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
    orderBy: [{ daysUntilStockout: "asc" }, { unitsSold30Days: "desc" }],
  });

  const suppliers = await prisma.supplier.findMany({
    where: { storeId: store.id, isArchived: false },
    orderBy: { name: "asc" },
  });

  // Calculate reorder metrics & overrides per variant
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

  // Apply filters
  let filtered = reorderData;
  if (filterSupplier) {
    filtered = filtered.filter((v) => v.supplierId === filterSupplier);
  }
  if (filterRisk) {
    filtered = filtered.filter((v) => v.risk === filterRisk);
  }

  return {
    variants: filtered,
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
    lastSyncAt: store.lastSyncAt?.toISOString() ?? null,
    totalCount: reorderData.length,
    filteredCount: filtered.length,
    riskCounts: {
      critical: reorderData.filter((v) => v.risk === "Critical").length,
      reorderSoon: reorderData.filter((v) => v.risk === "Reorder Soon").length,
      watch: reorderData.filter((v) => v.risk === "Watch").length,
      healthy: reorderData.filter((v) => v.risk === "Healthy").length,
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "reorder-action");
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) return { ok: false, message: "Store not found. Open the dashboard first." } satisfies ActionData;

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "save-override") {
    const variantId = String(formData.get("variantId") || "").trim();
    const rawOverrideQty = formData.get("overrideQuantity");
    const notes = String(formData.get("notes") || "").trim();

    if (!variantId) {
      return { ok: false, message: "Variant ID is required." } satisfies ActionData;
    }

    const variant = await prisma.shopifyVariant.findFirst({
      where: { id: variantId, storeId: store.id },
    });
    if (!variant) {
      return { ok: false, message: "Variant not found or does not belong to this store." } satisfies ActionData;
    }

    if (notes.length > 300) {
      return { ok: false, message: "Notes/reason must be 300 characters or fewer." } satisfies ActionData;
    }

    // Blank or empty input clears override
    if (rawOverrideQty === null || rawOverrideQty === "" || String(rawOverrideQty).trim() === "") {
      await prisma.reorderOverride.deleteMany({
        where: { storeId: store.id, variantId },
      });
      return { ok: true, message: "Manual override cleared." } satisfies ActionData;
    }

    const overrideQuantity = Number(rawOverrideQty);
    if (!Number.isInteger(overrideQuantity) || overrideQuantity < 0) {
      return { ok: false, message: "Override quantity must be a whole number greater than or equal to 0." } satisfies ActionData;
    }

    await prisma.reorderOverride.upsert({
      where: {
        storeId_variantId: {
          storeId: store.id,
          variantId,
        },
      },
      create: {
        storeId: store.id,
        variantId,
        overrideQuantity,
        notes: notes || null,
      },
      update: {
        overrideQuantity,
        notes: notes || null,
      },
    });

    return { ok: true, message: "Manual override saved successfully." } satisfies ActionData;
  }

  if (intent === "clear-override") {
    const variantId = String(formData.get("variantId") || "").trim();

    if (!variantId) {
      return { ok: false, message: "Variant ID is required." } satisfies ActionData;
    }

    const variant = await prisma.shopifyVariant.findFirst({
      where: { id: variantId, storeId: store.id },
    });
    if (!variant) {
      return { ok: false, message: "Variant not found or does not belong to this store." } satisfies ActionData;
    }

    await prisma.reorderOverride.deleteMany({
      where: { storeId: store.id, variantId },
    });

    return { ok: true, message: "Manual override cleared." } satisfies ActionData;
  }

  if (intent === "create-reorder-po") {
    const variantId = String(formData.get("variantId") || "").trim();
    const supplierId = String(formData.get("supplierId") || "").trim();
    const salesWindow = numberFromForm(formData.get("window"), 30);
    const bufferDays = numberFromForm(formData.get("buffer"), DEFAULT_BUFFER_DAYS);
    const targetDays = numberFromForm(formData.get("target"), DEFAULT_TARGET_DAYS);

    if (!variantId || !supplierId) {
      return { ok: false, message: "Variant and supplier are required." } satisfies ActionData;
    }

    const mapping = await prisma.supplierVariantMapping.findFirst({
      where: { storeId: store.id, variantId, supplierId },
      include: {
        supplier: true,
        variant: {
          include: {
            reorderOverrides: {
              where: { storeId: store.id },
              take: 1,
            },
          },
        },
      },
    });
    if (!mapping || mapping.supplier.isArchived) {
      return { ok: false, message: "Active supplier mapping not found for this SKU." } satisfies ActionData;
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

    // Fetch and validate selected variants
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
        return { ok: false, message: `Variant "${v.product.title} (${v.title})` + `" does not have an active mapped supplier.` } satisfies ActionData;
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
        return { ok: false, message: `Variant "${v.product.title} (${v.title})` + `" does not have a positive final suggested reorder quantity.` } satisfies ActionData;
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

  // Eligible variants for bulk selection: must have supplier & finalSuggestedQty > 0
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
    <s-page heading="Reorder Planning">
      {actionData?.message ? (
        <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
      ) : null}

      <s-section heading="Risk summary">
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
        <s-paragraph>
          Last sync: {data.lastSyncAt ? formatDateTime(data.lastSyncAt) : "Never synced"}
        </s-paragraph>
      </s-section>

      <s-section heading="Filters">
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "end", marginBottom: "12px" }}>
          <label style={fieldLabelStyle}>
            Sales window model
            <select
              value={currentWindow}
              onChange={(e) => updateFilter("window", e.target.value)}
              style={inputStyle}
            >
              {SALES_WINDOWS.map((w) => (
                <option key={w} value={String(w)}>{w} days (velocity est.)</option>
              ))}
            </select>
          </label>
          <label style={fieldLabelStyle}>
            Buffer days
            <input
              type="number"
              value={currentBuffer}
              min="0"
              onChange={(e) => updateFilter("buffer", e.target.value)}
              style={{ ...inputStyle, width: "80px" }}
            />
          </label>
          <label style={fieldLabelStyle}>
            Target stock days
            <input
              type="number"
              value={currentTarget}
              min="1"
              onChange={(e) => updateFilter("target", e.target.value)}
              style={{ ...inputStyle, width: "80px" }}
            />
          </label>
          <label style={fieldLabelStyle}>
            Supplier
            <select
              value={currentSupplier}
              onChange={(e) => updateFilter("supplier", e.target.value)}
              style={inputStyle}
            >
              <option value="">All suppliers</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label style={fieldLabelStyle}>
            Risk
            <select
              value={currentRisk}
              onChange={(e) => updateFilter("risk", e.target.value)}
              style={inputStyle}
            >
              <option value="">All</option>
              <option value="Critical">Critical</option>
              <option value="Reorder Soon">Reorder Soon</option>
              <option value="Watch">Watch</option>
              <option value="Healthy">Healthy</option>
            </select>
          </label>
        </div>

        <div style={formulaExplanationStyle}>
          <strong>Formula explanation:</strong> Suggested qty = target stock days x average daily sales - current stock. Lead time and buffer affect risk level. Manual overrides do not change Shopify inventory.
        </div>

        <div style={{ ...mutedStyle, marginTop: "8px", marginBottom: "16px" }}>
          Showing {data.filteredCount} of {data.totalCount} tracked variants. Sales figures for 7, 14, and 90 days are estimated from your synced 30-day sales velocity model.
        </div>
      </s-section>

      <s-section heading="Reorder table">
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
                <a href="/app" style={actionBtnStyle}>Go to Dashboard to Sync</a>
                <a href="/app/mappings" style={secondaryLinkBtnStyle}>Map SKUs</a>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: "36px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={isAllSelectableChecked}
                      onChange={handleToggleAll}
                      disabled={selectableVariants.length === 0}
                      title="Select all eligible rows for bulk PO"
                    />
                  </th>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Stock</th>
                  <th style={thStyle}>Est. sold ({currentWindow}d)</th>
                  <th style={thStyle}>Avg/day</th>
                  <th style={thStyle}>Days left</th>
                  <th style={thStyle}>Supplier</th>
                  <th style={thStyle}>Lead</th>
                  <th style={thStyle}>Reason</th>
                  <th style={thStyle}>Formula qty</th>
                  <th style={thStyle}>Final qty</th>
                  <th style={thStyle}>Override</th>
                  <th style={thStyle}>Action</th>
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
                        {v.productTitle}
                        <div style={mutedStyle}>{v.variantTitle}</div>
                      </td>
                      <td style={tdStyle}>{v.sku || "-"}</td>
                      <td style={tdStyle}>{v.inventoryQuantity}</td>
                      <td style={tdStyle}>{v.unitsSoldInWindow}</td>
                      <td style={tdStyle}>{v.avgDailySales}</td>
                      <td style={tdStyle}>{v.daysLeft != null ? v.daysLeft : "-"}</td>
                      <td style={tdStyle}>
                        {v.supplierName ? (
                          <a href={`/app/suppliers/${v.supplierId}`} style={linkStyle}>{v.supplierName}</a>
                        ) : (
                          <span style={mutedStyle}>Unmapped</span>
                        )}
                      </td>
                      <td style={tdStyle}>{v.supplierLeadTime != null ? `${v.supplierLeadTime}d` : "-"}</td>
                      <td style={tdStyle}>
                        <span style={riskBadge(v.risk)}>{v.risk}</span>
                        <div style={riskReasonSubtextStyle}>{v.riskReason}</div>
                      </td>
                      <td style={tdStyle}>{v.suggestedQtyFormula != null ? v.suggestedQtyFormula : "-"}</td>
                      <td style={{ ...tdStyle, fontWeight: v.hasOverride ? 700 : 400 }}>
                        {v.finalSuggestedQty != null ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
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
                          <a href="/app/mappings" style={{ ...linkStyle, fontSize: "12px" }}>Map supplier</a>
                        ) : v.avgDailySales === 0 ? (
                          <span style={{ ...mutedStyle, fontSize: "12px" }}>No recent sales</span>
                        ) : (
                          <span style={{ ...mutedStyle, fontSize: "12px" }}>Stock OK</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </s-section>
    </s-page>
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
const metricGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", marginBottom: "8px" } as const;
const riskMetric = (borderColor: string) => ({ border: `2px solid ${borderColor}`, borderRadius: "8px", padding: "14px", background: "#fff" }) as const;
const metricValueStyle = { fontSize: "24px", fontWeight: 700, color: "#202223" } as const;
const mutedStyle = { color: "#6d7175", fontSize: "13px", marginTop: "4px" } as const;
const fieldLabelStyle = { display: "grid", gap: "6px", color: "#202223", fontSize: "13px", fontWeight: 600 } as const;
const inputStyle = { border: "1px solid #c9cccf", borderRadius: "6px", padding: "9px 10px", fontSize: "14px", width: "100%" } as const;
const linkStyle = { color: "#2c6ecb", textDecoration: "none" } as const;
const smallBtnStyle = { border: "1px solid #c9cccf", borderRadius: "4px", padding: "4px 8px", background: "#fff", cursor: "pointer", fontSize: "12px", whiteSpace: "nowrap" } as const;
const clearBtnStyle = { border: "none", background: "none", color: "#d72c0d", cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: "0" } as const;
const actionBtnStyle = { border: "1px solid #008060", borderRadius: "4px", padding: "6px 12px", background: "#008060", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", textDecoration: "none", display: "inline-block" } as const;
const secondaryLinkBtnStyle = { border: "1px solid #c9cccf", borderRadius: "4px", padding: "6px 12px", background: "#fff", color: "#202223", cursor: "pointer", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", textDecoration: "none", display: "inline-block" } as const;
const disabledPrimaryBtnStyle = { border: "1px solid #8c9196", borderRadius: "4px", padding: "6px 12px", background: "#8c9196", color: "#fff", cursor: "not-allowed", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" } as const;
const overrideInputStyle = { width: "60px", border: "1px solid #c9cccf", borderRadius: "4px", padding: "4px 6px", fontSize: "12px" } as const;
const overrideReasonInputStyle = { width: "110px", border: "1px solid #c9cccf", borderRadius: "4px", padding: "4px 6px", fontSize: "12px" } as const;
const overrideBadgeStyle = { background: "#e4e8ec", color: "#202223", padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap" } as const;
const riskReasonSubtextStyle = { fontSize: "11px", color: "#6d7175", marginTop: "4px", maxWidth: "160px", lineHeight: "1.2" } as const;
const formulaExplanationStyle = { marginBottom: "12px", padding: "10px 14px", background: "#f4f6f8", border: "1px solid #c9cccf", borderRadius: "6px", color: "#202223", fontSize: "13px", lineHeight: "1.4" } as const;
const bulkActionBarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", padding: "10px 14px", background: "#eaf5fe", border: "1px solid #2c6ecb", borderRadius: "6px", marginBottom: "12px", fontSize: "13px" } as const;
const supplierBadgeStyle = { background: "#fff", color: "#1f5199", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, border: "1px solid #2c6ecb" } as const;
const warningBadgeStyle = { background: "#fff4f4", color: "#d72c0d", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, border: "1px solid #d72c0d" } as const;
const emptyCardStyle = { padding: "20px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", textAlign: "left" } as const;
const tableWrapStyle = { overflowX: "auto" } as const;
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "14px" } as const;
const thStyle = { textAlign: "left", borderBottom: "1px solid #dfe3e8", padding: "10px 8px", whiteSpace: "nowrap" } as const;
const tdStyle = { borderBottom: "1px solid #f1f2f3", padding: "10px 8px", verticalAlign: "top" } as const;
const noticeStyle = (ok: boolean) => ({ border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`, background: ok ? "#effaf5" : "#fff4f4", borderRadius: "8px", marginTop: "12px", marginBottom: "12px", padding: "10px 12px", color: ok ? "#0f5132" : "#8a1f11" }) as const;

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
