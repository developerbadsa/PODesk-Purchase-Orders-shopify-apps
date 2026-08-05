import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation , useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin, type AdminAuthResult } from "../authenticate-admin.server";
import prisma from "../db.server";

type AdminClient = AdminAuthResult["admin"];

type ActionData = {
  ok: boolean;
  message: string;
};

const STOCKOUT_WINDOW_DAYS = 14;
const SALES_WINDOW_DAYS = 30;
const VARIANTS_PER_PAGE = 50;
const ORDERS_PER_PAGE = 25;
// MVP safety limit: limit nested line items per order to prevent Shopify GraphQL query cost errors
const ORDER_LINE_ITEMS_PER_ORDER_LIMIT = 25;
const MAX_VARIANT_PAGES = 200;
const MAX_ORDER_PAGES = 10;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "dashboard-loader");
  const store = await getOrCreateStore(session.shop);

  const [
    variantCount,
    supplierCount,
    mappedSkuCount,
    openPurchaseOrderCount,
    partiallyReceivedPoCount,
    receiptCount,
    importJobCount,
    atRiskVariants,
    recentPurchaseOrders,
    inventoryUnits,
  ] = await Promise.all([
    prisma.shopifyVariant.count({ where: { storeId: store.id } }),
    prisma.supplier.count({ where: { storeId: store.id, isArchived: false } }),
    prisma.supplierVariantMapping.count({ where: { storeId: store.id } }),
    prisma.purchaseOrder.count({
      where: {
        storeId: store.id,
        status: { in: ["DRAFT", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "DELAYED"] },
      },
    }),
    prisma.purchaseOrder.count({
      where: {
        storeId: store.id,
        status: "PARTIALLY_RECEIVED",
      },
    }),
    prisma.purchaseOrderReceipt.count({ where: { storeId: store.id } }),
    prisma.importJob.count({ where: { storeId: store.id } }),
    prisma.shopifyVariant.findMany({
      where: {
        storeId: store.id,
        averageDailySales: { gt: 0 },
        OR: [
          { daysUntilStockout: null },
          { daysUntilStockout: { lte: STOCKOUT_WINDOW_DAYS } },
        ],
      },
      include: { product: true },
      orderBy: [{ daysUntilStockout: "asc" }, { unitsSold30Days: "desc" }],
      take: 8,
    }),
    prisma.purchaseOrder.findMany({
      where: { storeId: store.id },
      include: { supplier: true, lines: { include: { receiptLines: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.shopifyVariant.aggregate({
      where: { storeId: store.id },
      _sum: { inventoryQuantity: true, unitsSold30Days: true },
    }),
  ]);

  return {
    shop: session.shop,
    lastSyncAt: store.lastSyncAt?.toISOString() ?? null,
    metrics: {
      variantCount,
      supplierCount,
      mappedSkuCount,
      openPurchaseOrderCount,
      partiallyReceivedPoCount,
      receiptCount,
      importJobCount,
      totalInventory: inventoryUnits._sum.inventoryQuantity ?? 0,
      unitsSold30Days: inventoryUnits._sum.unitsSold30Days ?? 0,
    },
    atRiskVariants: atRiskVariants.map((variant) => ({
      id: variant.id,
      productTitle: variant.product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      inventoryQuantity: variant.inventoryQuantity,
      unitsSold30Days: variant.unitsSold30Days,
      daysUntilStockout: variant.daysUntilStockout,
    })),
    recentPurchaseOrders: recentPurchaseOrders.map((po) => {
      const totalOrdered = po.lines.reduce((sum, l) => sum + l.quantity, 0);
      const totalReceived = po.lines.reduce(
        (sum, l) => sum + l.receiptLines.reduce((rSum, rl) => rSum + rl.quantityReceived, 0),
        0
      );
      return {
        id: po.id,
        reference: po.reference,
        supplier: po.supplier.name,
        status: po.status,
        expectedArrival: po.expectedArrival?.toISOString() ?? null,
        lineCount: po.lines.length,
        totalOrdered,
        totalReceived,
        createdAt: po.createdAt.toISOString(),
      };
    }),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticateAdmin(request, "dashboard-action");
  const store = await getOrCreateStore(session.shop);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent !== "sync") {
    return { ok: false, message: "Unknown action." } satisfies ActionData;
  }

  try {
    const synced = await syncShopifyInventory(admin, store.id);
    const modeNote =
      synced.locationAccessDenied
        ? " Location-level inventory was skipped because Shopify denied location access. Reinstall the dev app and approve product, inventory, location, and order scopes."
        : "";

    return {
      ok: true,
      message: `Basic MVP sync complete: synced ${synced.products} products, ${synced.variants} variants, ${synced.locations} locations. Orders scanned: ${synced.ordersScanned}.${modeNote}`,
    } satisfies ActionData;
  } catch (error) {
    const msg = normalizeShopifyError(error);
    console.error("[PODesk] Sync error:", msg);
    return { ok: false, message: msg } satisfies ActionData;
  }
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSyncing = navigation.state === "submitting";
  const hasInventory = data.metrics.variantCount > 0;
  const hasSupplier = data.metrics.supplierCount > 0;
  const hasMapping = data.metrics.mappedSkuCount > 0;
  const hasImport = data.metrics.importJobCount > 0;
  const hasPo = data.metrics.openPurchaseOrderCount > 0 || data.recentPurchaseOrders.length > 0;
  const hasReceived = data.metrics.receiptCount > 0;

  // Determine dynamic Next Best Action
  let nextAction = {
    title: "Sync Shopify inventory",
    text: "Pull variants, inventory quantities, and recent sales velocity to activate PODesk.",
    href: "/app",
    btnText: "Sync inventory now",
    isSync: true,
  };

  if (hasInventory && !hasSupplier) {
    nextAction = {
      title: "Add your first supplier",
      text: "Store supplier lead times, terms, notes, and contact details.",
      href: "/app/suppliers",
      btnText: "Add supplier",
      isSync: false,
    };
  } else if (hasInventory && hasSupplier && !hasMapping) {
    nextAction = {
      title: "Map SKUs to suppliers",
      text: "Connect Shopify SKUs to suppliers and set unit costs for automated purchase orders.",
      href: "/app/mappings",
      btnText: "Map SKUs",
      isSync: false,
    };
  } else if (hasInventory && hasSupplier && hasMapping && !hasPo) {
    nextAction = {
      title: "Create your first purchase order",
      text: "Build a multi-line purchase order from your mapped SKUs.",
      href: "/app/purchase-orders",
      btnText: "Create purchase order",
      isSync: false,
    };
  } else if (hasPo && !hasReceived) {
    nextAction = {
      title: "Record PO receiving",
      text: "Track partial or full receipt of ordered items as shipments arrive.",
      href: "/app/purchase-orders",
      btnText: "View purchase orders",
      isSync: false,
    };
  } else if (hasPo && hasReceived) {
    nextAction = {
      title: "Review reorder planning",
      text: "Check stockout risk predictions and suggested replenishment quantities.",
      href: "/app/reorder",
      btnText: "Open reorder planning",
      isSync: false,
    };
  }

  return (
    <s-page heading="Dashboard">
      <div style={betaBannerStyle}>
        <strong>Free Beta:</strong> All features are unlocked in this development build. No subscription required.
      </div>

      {/* Main Hero Card */}
      <s-section heading="Store Overview">
        <div style={formCardStyle}>
          <div style={heroGridStyle}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <img
                  src="/brand/podesk-app-icon.png"
                  alt="PODesk"
                  style={{ width: "32px", height: "32px", borderRadius: "6px", flexShrink: 0 }}
                />
                <span style={badgeStyle}>Connected Store</span>
              </div>
              <h2 style={heroTitleStyle}>{data.shop}</h2>
              <p style={bodyStyle}>
                Sync Shopify SKUs, manage supplier lead times, map costs, and generate purchase orders automatically.
              </p>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <Form method="post">
                  <input type="hidden" name="intent" value="sync" />
                  <button type="submit" disabled={isSyncing} style={primaryButtonStyle}>
                    {isSyncing ? "Syncing Inventory..." : "Sync Shopify Inventory"}
                  </button>
                </Form>
                <a href="/app/purchase-orders" style={secondaryButtonStyle}>Create PO</a>
                <a href="/app/reorder" style={secondaryButtonStyle}>Reorder Planning</a>
              </div>
            </div>
            <div style={syncBoxStyle}>
              <div style={syncLabelStyle}>Last Sync Status</div>
              <div style={syncValueStyle}>
                {data.lastSyncAt ? formatDateTime(data.lastSyncAt) : "Never synced"}
              </div>
              <div style={mutedStyle}>
                Read-only inventory & sales velocity sync.
              </div>
            </div>
          </div>
          {actionData?.message ? (
            <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
          ) : null}
        </div>
      </s-section>

      {/* Dynamic Recommended Action */}
      <s-section heading="Recommended Next Action">
        <div style={nextActionCardStyle}>
          <div>
            <div style={nextActionLabelStyle}>Recommended Step</div>
            <div style={nextActionTitleStyle}>{nextAction.title}</div>
            <div style={{ ...mutedStyle, marginTop: "2px" }}>{nextAction.text}</div>
          </div>
          <div>
            {nextAction.isSync ? (
              <Form method="post">
                <input type="hidden" name="intent" value="sync" />
                <button type="submit" disabled={isSyncing} style={primaryButtonStyle}>
                  {isSyncing ? "Syncing..." : nextAction.btnText}
                </button>
              </Form>
            ) : (
              <a href={nextAction.href} style={primaryBtnLinkStyle}>
                {nextAction.btnText}
              </a>
            )}
          </div>
        </div>
      </s-section>

      {/* KPI Operations Snapshot */}
      <s-section heading="Operations Snapshot">
        <div style={metricGridStyle}>
          <Metric label="Synced Variants" value={data.metrics.variantCount} sub={`${data.metrics.totalInventory.toLocaleString()} units in stock`} accent="#008060" />
          <Metric label="30-Day Sales" value={data.metrics.unitsSold30Days} sub="Units sold" accent="#2c6ecb" />
          <Metric label="Suppliers & SKUs" value={data.metrics.supplierCount} sub={`${data.metrics.mappedSkuCount} mapped SKUs`} accent="#5c5f62" />
          <Metric label="Open POs" value={data.metrics.openPurchaseOrderCount} sub={`${data.metrics.partiallyReceivedPoCount} receiving`} accent="#8a5a00" />
        </div>
      </s-section>

      {/* Stockout Risk & Reorder Planning */}
      <s-section heading="Reorder Risk Attention">
        {data.atRiskVariants.length === 0 ? (
          <EmptyState
            title="All inventory counts healthy"
            text="No SKUs currently projected to run out within 14 days based on daily velocity and lead times."
            actionHref="/app/reorder"
            actionText="Open Reorder Table"
          />
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Product / Variant</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Stock</th>
                  <th style={thStyle}>30d Demand</th>
                  <th style={thStyle}>Days Remaining</th>
                </tr>
              </thead>
              <tbody>
                {data.atRiskVariants.map((variant) => (
                  <tr key={variant.id}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 600, color: "#202223" }}>{variant.productTitle}</span>
                      <div style={mutedStyle}>{variant.variantTitle}</div>
                    </td>
                    <td style={tdStyle}>{variant.sku || "-"}</td>
                    <td style={tdStyle}>{variant.inventoryQuantity}</td>
                    <td style={tdStyle}>{variant.unitsSold30Days}</td>
                    <td style={tdStyle}>
                      {variant.daysUntilStockout == null ? (
                        "-"
                      ) : (
                        <span style={riskBadgeStyle(variant.daysUntilStockout <= 7)}>
                          {Math.round(variant.daysUntilStockout)} days
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </s-section>

      {/* Recent POs */}
      <s-section heading="Recent Purchase Orders">
        {data.recentPurchaseOrders.length === 0 ? (
          <EmptyState
            title="No purchase orders created yet"
            text="Once suppliers and SKU mappings are set up, draft your first purchase order."
            actionHref="/app/purchase-orders"
            actionText="Create Purchase Order"
          />
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Reference</th>
                  <th style={thStyle}>Supplier</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Lines</th>
                  <th style={thStyle}>Receiving</th>
                  <th style={thStyle}>Expected</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPurchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td style={tdStyle}>
                      <a href={`/app/purchase-orders/${po.id}`} style={linkStyle}>
                        {po.reference}
                      </a>
                    </td>
                    <td style={tdStyle}>{po.supplier}</td>
                    <td style={tdStyle}>
                      <span style={statusBadgeStyle(po.status)}>{po.status.replaceAll("_", " ")}</span>
                    </td>
                    <td style={tdStyle}>{po.lineCount}</td>
                    <td style={tdStyle}>
                      {po.totalOrdered > 0 ? `${po.totalReceived} / ${po.totalOrdered}` : "-"}
                    </td>
                    <td style={tdStyle}>
                      {po.expectedArrival ? formatDate(po.expectedArrival) : "-"}
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

function Metric({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: string }) {
  return (
    <div style={{ ...metricStyle, borderTop: accent ? `3px solid ${accent}` : "1px solid #dfe3e8" }}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value.toLocaleString()}</div>
      {sub ? <div style={{ ...mutedStyle, marginTop: "2px", fontSize: "12px" }}>{sub}</div> : null}
    </div>
  );
}

function EmptyState({
  title,
  text,
  actionHref,
  actionText,
}: {
  title: string;
  text: string;
  actionHref: string;
  actionText: string;
}) {
  return (
    <div style={emptyStateStyle}>
      <div>
        <div style={emptyTitleStyle}>{title}</div>
        <div style={mutedStyle}>{text}</div>
      </div>
      <a href={actionHref} style={secondaryButtonStyle}>{actionText}</a>
    </div>
  );
}

async function getOrCreateStore(shop: string) {
  return prisma.store.upsert({
    where: { shop },
    update: {},
    create: { shop },
  });
}

async function syncShopifyInventory(admin: AdminClient, storeId: string) {
  const locationResult = await tryShopifyGraphql(admin, LOCATIONS_QUERY, {});
  const locationAccessDenied = !locationResult.ok;
  const locationNodes = locationResult.ok ? locationResult.data.locations?.nodes ?? [] : [];
  const syncedLocationIds = new Set<string>();

  for (const location of locationNodes) {
    await prisma.inventoryLocation.upsert({
      where: { storeId_shopifyLocationId: { storeId, shopifyLocationId: location.id } },
      update: { name: location.name, isActive: location.isActive },
      create: {
        storeId,
        shopifyLocationId: location.id,
        name: location.name,
        isActive: location.isActive,
      },
    });
    syncedLocationIds.add(location.id);
  }

  const syncedProductIds = new Set<string>();
  let variantCount = 0;
  let hasNextVariantPage = true;
  let variantCursor: string | null = null;
  let pageCount = 0;

  while (hasNextVariantPage && pageCount < MAX_VARIANT_PAGES) {
    const variables: Record<string, unknown> = {
      first: VARIANTS_PER_PAGE,
    };
    if (variantCursor) variables.after = variantCursor;

    const variantData = await shopifyGraphql(admin, PRODUCT_VARIANTS_QUERY, variables);
    const variants = variantData.productVariants;
    if (!variants) break;

    for (const variant of variants.nodes as ProductVariantNode[]) {
      const product = variant.product;
      const productRecord = await prisma.shopifyProduct.upsert({
        where: { storeId_shopifyProductId: { storeId, shopifyProductId: product.id } },
        update: {
          title: product.title,
          handle: product.handle,
          status: product.status,
          vendor: product.vendor,
        },
        create: {
          storeId,
          shopifyProductId: product.id,
          title: product.title,
          handle: product.handle,
          status: product.status,
          vendor: product.vendor,
        },
      });
      syncedProductIds.add(product.id);

      await prisma.shopifyVariant.upsert({
        where: { storeId_shopifyVariantId: { storeId, shopifyVariantId: variant.id } },
        update: {
          productId: productRecord.id,
          shopifyInventoryId: variant.inventoryItem.id,
          title: variant.title,
          sku: variant.sku,
          barcode: variant.barcode,
          tracked: variant.inventoryItem.tracked,
          unitCostAmount: optionalFloat(variant.inventoryItem.unitCost?.amount),
          unitCostCurrency: variant.inventoryItem.unitCost?.currencyCode,
          inventoryQuantity: variant.inventoryQuantity,
        },
        create: {
          storeId,
          productId: productRecord.id,
          shopifyVariantId: variant.id,
          shopifyInventoryId: variant.inventoryItem.id,
          title: variant.title,
          sku: variant.sku,
          barcode: variant.barcode,
          tracked: variant.inventoryItem.tracked,
          unitCostAmount: optionalFloat(variant.inventoryItem.unitCost?.amount),
          unitCostCurrency: variant.inventoryItem.unitCost?.currencyCode,
          inventoryQuantity: variant.inventoryQuantity,
        },
      });
      variantCount += 1;
    }

    hasNextVariantPage = variants.pageInfo.hasNextPage;
    variantCursor = variants.pageInfo.endCursor;
    pageCount += 1;
  }

  const ordersResult = await tryShopifyGraphql(admin, ORDERS_QUERY, {
    first: ORDERS_PER_PAGE,
    lineItemsFirst: ORDER_LINE_ITEMS_PER_ORDER_LIMIT,
    orderQuery: `created_at:>=${thirtyDaysAgoIsoDate()}`,
  });
  const soldByVariant = new Map<string, number>();
  let ordersScanned = 0;

  if (ordersResult.ok) {
    let orders = ordersResult.data.orders;
    let orderCursor = orders?.pageInfo?.endCursor ?? null;
    let hasNextOrderPage = Boolean(orders?.pageInfo?.hasNextPage);
    let orderPageCount = 0;

    while (orders && orderPageCount < MAX_ORDER_PAGES) {
      for (const order of orders.nodes) {
        ordersScanned += 1;
        for (const lineItem of order.lineItems.nodes) {
          const variantId = lineItem.variant?.id;
          if (!variantId) continue;
          soldByVariant.set(variantId, (soldByVariant.get(variantId) ?? 0) + lineItem.quantity);
        }
      }

      if (!hasNextOrderPage || orderPageCount + 1 >= MAX_ORDER_PAGES) break;
      const nextOrderData = await shopifyGraphql(admin, ORDERS_QUERY, {
        first: ORDERS_PER_PAGE,
        lineItemsFirst: ORDER_LINE_ITEMS_PER_ORDER_LIMIT,
        after: orderCursor,
        orderQuery: `created_at:>=${thirtyDaysAgoIsoDate()}`,
      });
      orders = nextOrderData.orders;
      orderCursor = orders?.pageInfo?.endCursor ?? null;
      hasNextOrderPage = Boolean(orders?.pageInfo?.hasNextPage);
      orderPageCount += 1;
    }
  }

  const allVariants = await prisma.shopifyVariant.findMany({
    where: { storeId },
    select: { id: true, shopifyVariantId: true, inventoryQuantity: true },
  });

  for (const variant of allVariants) {
    const unitsSold30Days = soldByVariant.get(variant.shopifyVariantId) ?? 0;
    const averageDailySales = unitsSold30Days / SALES_WINDOW_DAYS;
    const daysUntilStockout =
      averageDailySales > 0 ? variant.inventoryQuantity / averageDailySales : null;

    await prisma.shopifyVariant.update({
      where: { id: variant.id },
      data: { unitsSold30Days, averageDailySales, daysUntilStockout },
    });
  }

  await prisma.store.update({
    where: { id: storeId },
    data: { lastSyncAt: new Date() },
  });

  return {
    products: syncedProductIds.size,
    variants: variantCount,
    locations: syncedLocationIds.size,
    ordersScanned,
    locationAccessDenied,
  };
}

async function shopifyGraphql(
  admin: AdminClient,
  query: string,
  variables: Record<string, unknown>,
) {
  const response = await admin.graphql(query, { variables });
  const payload = (await response.json()) as {
    data?: Record<string, unknown>;
    errors?: Array<{ message: string }>;
  };

  if (payload.errors && payload.errors.length > 0) {
    const messages = payload.errors.map((e) => e.message).join("; ");
    throw new Error(messages);
  }

  if (!payload.data) {
    throw new Error("Shopify returned empty data. Reinstall the app and approve the requested scopes.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return payload.data as any;
}

async function tryShopifyGraphql(
  admin: AdminClient,
  query: string,
  variables: Record<string, unknown>,
) {
  try {
    return { ok: true as const, data: await shopifyGraphql(admin, query, variables) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("access denied")) {
      console.warn("[PODesk] Shopify scope fallback:", message);
      return { ok: false as const, message };
    }
    throw error;
  }
}

function normalizeShopifyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("access denied")) {
    return "Shopify denied the required Admin API permissions. Uninstall PODesk from this dev store, run npm run dev -- --reset, reinstall from the dev preview, and approve product, inventory, location, and order scopes.";
  }
  if (message.toLowerCase().includes("query cost")) {
    return "Shopify rejected the sync because the Admin API query was too large. PODesk has been updated to use smaller product and order pages. Restart the dev server and try sync again.";
  }
  return `Sync failed: ${message}`;
}

const LOCATIONS_QUERY = `#graphql
  query PODeskLocations {
    locations(first: 25) {
      nodes {
        id
        name
        isActive
      }
    }
  }`;

const PRODUCT_VARIANTS_QUERY = `#graphql
  query PODeskProductVariants($first: Int!, $after: String) {
    productVariants(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        sku
        barcode
        inventoryQuantity
        inventoryItem {
          id
          tracked
          unitCost {
            amount
            currencyCode
          }
        }
        product {
          id
          title
          handle
          status
          vendor
        }
      }
    }
  }`;

// TODO: Implement Shopify Bulk Operations or paginated nested line item queries for enterprise-grade order sync (25+ line items per order).
const ORDERS_QUERY = `#graphql
  query PODeskOrders($first: Int!, $after: String, $orderQuery: String!, $lineItemsFirst: Int!) {
    orders(first: $first, after: $after, query: $orderQuery, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        lineItems(first: $lineItemsFirst) {
          nodes {
            quantity
            variant {
              id
            }
          }
        }
      }
    }
  }`;

type ProductVariantNode = {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  inventoryQuantity: number;
  inventoryItem: {
    id: string;
    tracked: boolean;
    unitCost: { amount: string; currencyCode: string } | null;
  };
  product: {
    id: string;
    title: string;
    handle: string | null;
    status: string | null;
    vendor: string | null;
  };
};

function optionalFloat(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function thirtyDaysAgoIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() - SALES_WINDOW_DAYS);
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

const betaBannerStyle = {
  border: "1px solid #95c9b4",
  background: "#effaf5",
  color: "#0f5132",
  borderRadius: "8px",
  padding: "10px 14px",
  marginBottom: "16px",
  fontSize: "13px",
} as const;

const nextActionCardStyle = {
  border: "1px solid #b3d4ff",
  borderRadius: "8px",
  padding: "16px",
  background: "#f4f8ff",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "16px",
} as const;

const nextActionLabelStyle = {
  color: "#1f5199",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: "4px",
} as const;

const nextActionTitleStyle = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#1a1a1a",
  marginBottom: "4px",
} as const;

const primaryBtnLinkStyle = {
  display: "inline-block",
  border: "0",
  borderRadius: "6px",
  padding: "10px 18px",
  background: "#008060",
  color: "#fff",
  fontWeight: 650,
  textDecoration: "none",
  fontSize: "14px",
} as const;

const heroGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 320px)",
  gap: "20px",
  alignItems: "start",
} as const;

const eyebrowStyle = {
  color: "#5c5f62",
  fontSize: "12px",
  fontWeight: 650,
  textTransform: "uppercase",
} as const;

const heroTitleStyle = {
  margin: "6px 0 8px",
  fontSize: "22px",
  lineHeight: 1.2,
} as const;

const bodyStyle = {
  margin: "0 0 16px",
  maxWidth: "680px",
  color: "#5c5f62",
} as const;

const syncBoxStyle = {
  border: "1px solid #dfe3e8",
  borderRadius: "8px",
  padding: "14px",
  background: "#f6f6f7",
} as const;

const syncLabelStyle = {
  color: "#6d7175",
  fontSize: "12px",
  fontWeight: 650,
} as const;

const syncValueStyle = {
  marginTop: "6px",
  fontSize: "16px",
  fontWeight: 650,
} as const;

const stepGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: "12px",
} as const;

const stepCardStyle = {
  display: "block",
  border: "1px solid #dfe3e8",
  borderRadius: "8px",
  padding: "14px",
  background: "#fff",
  color: "#202223",
  textDecoration: "none",
} as const;

const stepStatusStyle = (done: boolean) =>
  ({
    display: "inline-block",
    borderRadius: "999px",
    padding: "3px 8px",
    marginBottom: "10px",
    fontSize: "12px",
    fontWeight: 650,
    color: done ? "#0f5132" : "#5c5f62",
    background: done ? "#effaf5" : "#f1f2f3",
  }) as const;

const stepTitleStyle = {
  fontSize: "14px",
  fontWeight: 700,
  marginBottom: "4px",
} as const;

const formCardStyle = {
  background: "#ffffff",
  border: "1px solid #e1e3e5",
  borderRadius: "10px",
  padding: "20px 24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
} as const;

const badgeStyle = {
  background: "#f1f8f5",
  color: "#0b5137",
  border: "1px solid #d6e6df",
  borderRadius: "999px",
  padding: "4px 10px",
  fontSize: "12px",
  fontWeight: 650,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
} as const;

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "16px",
} as const;

const metricStyle = {
  border: "1px solid #e1e3e5",
  borderRadius: "10px",
  padding: "16px 20px",
  background: "#ffffff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
} as const;

const metricLabelStyle = {
  fontSize: "13px",
  fontWeight: 650,
  color: "#5c5f62",
  marginBottom: "4px",
} as const;

const metricValueStyle = {
  fontSize: "26px",
  fontWeight: 700,
  color: "#202223",
  lineHeight: 1.1,
} as const;

const riskBadgeStyle = (urgent: boolean) =>
  ({
    background: urgent ? "#fff4f4" : "#fff7ed",
    color: urgent ? "#d72c0d" : "#9c6d00",
    border: `1px solid ${urgent ? "#f8b4b4" : "#fcd34d"}`,
    borderRadius: "6px",
    padding: "3px 8px",
    fontSize: "12px",
    fontWeight: 650,
  }) as const;

const statusBadgeStyle = (status: string) => {
  const isOk = status === "RECEIVED" || status === "CONFIRMED";
  const isPending = status === "DRAFT" || status === "SENT";
  return {
    background: isOk ? "#effaf5" : isPending ? "#f4f6f8" : "#fff7ed",
    color: isOk ? "#0f5132" : isPending ? "#5c5f62" : "#8a5a00",
    borderRadius: "6px",
    padding: "3px 8px",
    fontSize: "12px",
    fontWeight: 600,
  } as const;
};

const mutedStyle = {
  color: "#6d7175",
  fontSize: "13px",
  marginTop: "4px",
} as const;

const emptyStateStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
  border: "1px solid #e1e3e5",
  borderRadius: "10px",
  padding: "20px 24px",
  background: "#ffffff",
} as const;

const emptyTitleStyle = {
  fontWeight: 700,
  fontSize: "15px",
  color: "#202223",
  marginBottom: "4px",
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
  padding: "12px 10px",
  whiteSpace: "nowrap",
  color: "#5c5f62",
  fontSize: "13px",
  fontWeight: 650,
} as const;

const tdStyle = {
  borderBottom: "1px solid #f1f2f3",
  padding: "12px 10px",
  verticalAlign: "middle",
} as const;

const primaryButtonStyle = {
  height: "40px",
  border: "0",
  borderRadius: "8px",
  padding: "0 20px",
  background: "#008060",
  color: "#fff",
  fontWeight: 650,
  fontSize: "14px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
} as const;

const secondaryButtonStyle = {
  height: "40px",
  border: "1px solid #c9cccf",
  borderRadius: "8px",
  padding: "0 16px",
  background: "#ffffff",
  color: "#202223",
  fontWeight: 600,
  fontSize: "14px",
  textDecoration: "none",
  whiteSpace: "nowrap",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

const linkStyle = {
  color: "#2c6ecb",
  textDecoration: "none",
  fontWeight: 600,
} as const;

const noticeStyle = (ok: boolean) =>
  ({
    border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`,
    background: ok ? "#effaf5" : "#fff4f4",
    borderRadius: "8px",
    marginTop: "12px",
    padding: "12px 16px",
    color: ok ? "#0f5132" : "#8a1f11",
    fontWeight: 550,
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
