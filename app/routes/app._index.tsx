import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

type AdminClient = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

type ActionData = {
  ok: boolean;
  message: string;
};

const STOCKOUT_WINDOW_DAYS = 14;
const SALES_WINDOW_DAYS = 30;
const MAX_PRODUCT_PAGES = 20; // 50 products per page = up to 1000 products
const MAX_ORDER_PAGES = 10;   // 100 orders per page = up to 1000 orders

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await getOrCreateStore(session.shop);

  const [
    variantCount,
    supplierCount,
    openPurchaseOrderCount,
    atRiskVariants,
    recentPurchaseOrders,
  ] = await Promise.all([
    prisma.shopifyVariant.count({ where: { storeId: store.id } }),
    prisma.supplier.count({ where: { storeId: store.id, isArchived: false } }),
    prisma.purchaseOrder.count({
      where: {
        storeId: store.id,
        status: { in: ["DRAFT", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "DELAYED"] },
      },
    }),
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
      take: 10,
    }),
    prisma.purchaseOrder.findMany({
      where: { storeId: store.id },
      include: { supplier: true, lines: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const inventoryUnits = await prisma.shopifyVariant.aggregate({
    where: { storeId: store.id },
    _sum: { inventoryQuantity: true, unitsSold30Days: true },
  });

  return {
    shop: session.shop,
    lastSyncAt: store.lastSyncAt?.toISOString() ?? null,
    metrics: {
      variantCount,
      supplierCount,
      openPurchaseOrderCount,
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
      averageDailySales: variant.averageDailySales,
      daysUntilStockout: variant.daysUntilStockout,
    })),
    recentPurchaseOrders: recentPurchaseOrders.map((po) => ({
      id: po.id,
      reference: po.reference,
      supplier: po.supplier.name,
      status: po.status,
      expectedArrival: po.expectedArrival?.toISOString() ?? null,
      lineCount: po.lines.length,
      createdAt: po.createdAt.toISOString(),
    })),
  };
};

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const store = await getOrCreateStore(session.shop);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "sync") {
    try {
      const synced = await syncShopifyInventory(admin, store.id);
      return {
        ok: true,
        message: `Synced ${synced.products} products, ${synced.variants} variants, ${synced.locations} locations. Orders scanned: ${synced.ordersScanned}.`,
      } satisfies ActionData;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown sync error";
      console.error("[PODesk] Sync error:", msg);
      return {
        ok: false,
        message: `Sync failed: ${msg}`,
      } satisfies ActionData;
    }
  }

  return { ok: false, message: "Unknown action." } satisfies ActionData;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSyncing = navigation.state === "submitting";

  return (
    <s-page heading="PODesk">
      <s-section heading="Shopify inventory sync">
        <s-stack direction="inline" gap="base">
          <Form method="post">
            <input type="hidden" name="intent" value="sync" />
            <button type="submit" disabled={isSyncing} style={buttonStyle}>
              {isSyncing ? "Syncing..." : "Sync Shopify inventory"}
            </button>
          </Form>
          <s-paragraph>
            <s-text>Store: {data.shop}</s-text>
          </s-paragraph>
        </s-stack>
        {actionData?.message ? (
          <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
        ) : null}
        <s-paragraph>
          Last sync: {data.lastSyncAt ? formatDateTime(data.lastSyncAt) : "Never synced"}
        </s-paragraph>
      </s-section>

      <s-section heading="Operations snapshot">
        <div style={metricGridStyle}>
          <Metric label="Variants synced" value={data.metrics.variantCount} />
          <Metric label="Inventory units" value={data.metrics.totalInventory} />
          <Metric label="Units sold, 30d" value={data.metrics.unitsSold30Days} />
          <Metric label="Suppliers" value={data.metrics.supplierCount} />
          <Metric label="Open POs" value={data.metrics.openPurchaseOrderCount} />
        </div>
      </s-section>

      <s-section heading="Reorder attention">
        {data.atRiskVariants.length === 0 ? (
          <s-paragraph>
            No stockout risk found yet. Sync data first, then add suppliers and
            lead times to improve recommendations.
          </s-paragraph>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>SKU</th>
                  <th style={thStyle}>Stock</th>
                  <th style={thStyle}>Sold 30d</th>
                  <th style={thStyle}>Days left</th>
                </tr>
              </thead>
              <tbody>
                {data.atRiskVariants.map((variant) => (
                  <tr key={variant.id}>
                    <td style={tdStyle}>
                      {variant.productTitle}
                      <div style={mutedStyle}>{variant.variantTitle}</div>
                    </td>
                    <td style={tdStyle}>{variant.sku || "No SKU"}</td>
                    <td style={tdStyle}>{variant.inventoryQuantity}</td>
                    <td style={tdStyle}>{variant.unitsSold30Days}</td>
                    <td style={tdStyle}>
                      {variant.daysUntilStockout == null
                        ? "Unknown"
                        : `${Math.round(variant.daysUntilStockout)} days`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </s-section>

      <s-section heading="Recent purchase orders">
        {data.recentPurchaseOrders.length === 0 ? (
          <s-paragraph>No purchase orders created yet.</s-paragraph>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Reference</th>
                  <th style={thStyle}>Supplier</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Lines</th>
                  <th style={thStyle}>Expected</th>
                </tr>
              </thead>
              <tbody>
                {data.recentPurchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td style={tdStyle}>
                      <a href={`/app/purchase-orders/${po.id}`} style={linkStyle}>{po.reference}</a>
                    </td>
                    <td style={tdStyle}>{po.supplier}</td>
                    <td style={tdStyle}>{po.status.replaceAll("_", " ")}</td>
                    <td style={tdStyle}>{po.lineCount}</td>
                    <td style={tdStyle}>
                      {po.expectedArrival ? formatDate(po.expectedArrival) : "Not set"}
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

// ---------------------------------------------------------------------------
// Store helper
// ---------------------------------------------------------------------------

async function getOrCreateStore(shop: string) {
  return prisma.store.upsert({
    where: { shop },
    update: {},
    create: { shop },
  });
}

// ---------------------------------------------------------------------------
// Paginated Shopify Inventory Sync (Gate 2)
// ---------------------------------------------------------------------------

async function syncShopifyInventory(admin: AdminClient, storeId: string) {
  // 1. Sync locations (single query, stores rarely have >25)
  const locationData = await shopifyGraphql(admin, LOCATIONS_QUERY, {});
  const locationNodes = locationData.locations?.nodes ?? [];
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

  // 2. Sync products with cursor-based pagination
  let productCount = 0;
  let variantCount = 0;
  let hasNextProductPage = true;
  let productCursor: string | null = null;
  let pageCount = 0;

  while (hasNextProductPage && pageCount < MAX_PRODUCT_PAGES) {
    const variables: Record<string, unknown> = { first: 50 };
    if (productCursor) variables.after = productCursor;

    const productData = await shopifyGraphql(admin, PRODUCTS_QUERY, variables);
    const products = productData.products;
    if (!products) break;

    for (const product of products.nodes) {
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
      productCount += 1;

      for (const variant of product.variants.nodes) {
        const locationQuantities = variant.inventoryItem.inventoryLevels.nodes;
        const availableFromLocations = locationQuantities.reduce(
          (total: number, level: InventoryLevelNode) =>
            total + availableQuantity(level.quantities),
          0,
        );
        const inventoryQuantity =
          locationQuantities.length > 0 ? availableFromLocations : variant.inventoryQuantity;

        const variantRecord = await prisma.shopifyVariant.upsert({
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
            inventoryQuantity,
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
            inventoryQuantity,
          },
        });
        variantCount += 1;

        // Save inventory levels per location
        for (const level of locationQuantities) {
          const locationRecord = await prisma.inventoryLocation.upsert({
            where: { storeId_shopifyLocationId: { storeId, shopifyLocationId: level.location.id } },
            update: { name: level.location.name, isActive: level.location.isActive },
            create: {
              storeId,
              shopifyLocationId: level.location.id,
              name: level.location.name,
              isActive: level.location.isActive,
            },
          });
          syncedLocationIds.add(level.location.id);

          await prisma.inventoryLevel.upsert({
            where: {
              variantId_locationId: {
                variantId: variantRecord.id,
                locationId: locationRecord.id,
              },
            },
            update: { available: availableQuantity(level.quantities) },
            create: {
              variantId: variantRecord.id,
              locationId: locationRecord.id,
              available: availableQuantity(level.quantities),
            },
          });
        }
      }
    }

    hasNextProductPage = products.pageInfo.hasNextPage;
    productCursor = products.pageInfo.endCursor;
    pageCount += 1;
  }

  // 3. Sync recent orders with cursor-based pagination
  const orderQuery = `created_at:>=${thirtyDaysAgoIsoDate()}`;
  const soldByVariant = new Map<string, number>();
  let hasNextOrderPage = true;
  let orderCursor: string | null = null;
  let orderPageCount = 0;
  let ordersScanned = 0;

  while (hasNextOrderPage && orderPageCount < MAX_ORDER_PAGES) {
    const variables: Record<string, unknown> = { first: 100, orderQuery };
    if (orderCursor) variables.after = orderCursor;

    const orderData = await shopifyGraphql(admin, ORDERS_QUERY, variables);
    const orders = orderData.orders;
    if (!orders) break;

    for (const order of orders.nodes) {
      ordersScanned += 1;
      for (const lineItem of order.lineItems.nodes) {
        const variantId = lineItem.variant?.id;
        if (!variantId) continue;
        soldByVariant.set(variantId, (soldByVariant.get(variantId) ?? 0) + lineItem.quantity);
      }
    }

    hasNextOrderPage = orders.pageInfo.hasNextPage;
    orderCursor = orders.pageInfo.endCursor;
    orderPageCount += 1;
  }

  // 4. Update sales velocity for all variants in this store
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

  // 5. Update store lastSyncAt
  await prisma.store.update({
    where: { id: storeId },
    data: { lastSyncAt: new Date() },
  });

  return {
    products: productCount,
    variants: variantCount,
    locations: syncedLocationIds.size,
    ordersScanned,
  };
}

// ---------------------------------------------------------------------------
// Shopify GraphQL helpers
// ---------------------------------------------------------------------------

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
    throw new Error(`Shopify GraphQL error: ${messages}`);
  }

  if (!payload.data) {
    throw new Error("Shopify returned empty data. Check API scopes and try again.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return payload.data as any;
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

const PRODUCTS_QUERY = `#graphql
  query PODeskProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        status
        vendor
        variants(first: 100) {
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
              inventoryLevels(first: 20) {
                nodes {
                  id
                  quantities(names: ["available"]) {
                    name
                    quantity
                  }
                  location {
                    id
                    name
                    isActive
                  }
                }
              }
            }
          }
        }
      }
    }
  }`;

const ORDERS_QUERY = `#graphql
  query PODeskOrders($first: Int!, $after: String, $orderQuery: String!) {
    orders(first: $first, after: $after, query: $orderQuery, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        lineItems(first: 100) {
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InventoryLevelNode = {
  id: string;
  quantities: Array<{ name: string; quantity: number }>;
  location: { id: string; name: string; isActive: boolean };
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function availableQuantity(quantities: Array<{ name: string; quantity: number }>) {
  return quantities.find((q) => q.name === "available")?.quantity ?? 0;
}

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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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

const buttonStyle = {
  border: "0",
  borderRadius: "6px",
  padding: "10px 14px",
  background: "#008060",
  color: "#fff",
  fontWeight: 650,
  cursor: "pointer",
} as const;

const linkStyle = {
  color: "#2c6ecb",
  textDecoration: "none",
} as const;

const noticeStyle = (ok: boolean) =>
  ({
    border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`,
    background: ok ? "#effaf5" : "#fff4f4",
    borderRadius: "8px",
    marginTop: "12px",
    padding: "10px 12px",
    color: ok ? "#0f5132" : "#8a1f11",
  }) as const;

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
