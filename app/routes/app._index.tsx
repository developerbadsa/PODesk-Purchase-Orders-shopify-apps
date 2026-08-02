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
const PRODUCTS_PER_PAGE = 25;
// MVP safety limit: limit nested variants per product to prevent Shopify GraphQL query cost errors
const PRODUCT_VARIANTS_PER_PRODUCT_LIMIT = 100;
const ORDERS_PER_PAGE = 25;
// MVP safety limit: limit nested line items per order to prevent Shopify GraphQL query cost errors
const ORDER_LINE_ITEMS_PER_ORDER_LIMIT = 25;
const MAX_PRODUCT_PAGES = 40;
const MAX_ORDER_PAGES = 10;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await getOrCreateStore(session.shop);

  const [
    variantCount,
    supplierCount,
    mappedSkuCount,
    openPurchaseOrderCount,
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
  const { admin, session } = await authenticate.admin(request);
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
      message: `Basic MVP sync complete: synced ${synced.products} products, ${synced.variants} variants, ${synced.locations} locations. Orders scanned: ${synced.ordersScanned}. Note: Nested limits applied (${PRODUCT_VARIANTS_PER_PRODUCT_LIMIT} variants/product, ${ORDER_LINE_ITEMS_PER_ORDER_LIMIT} lines/order). Location inventory sync is intentionally disabled in dev until bulk sync is added.${modeNote}`,
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

  return (
    <s-page heading="PODesk">
      <s-section heading="Inventory buying workspace">
        <div style={heroGridStyle}>
          <div>
            <div style={eyebrowStyle}>Connected store</div>
            <h2 style={heroTitleStyle}>{data.shop}</h2>
            <p style={bodyStyle}>
              Sync Shopify SKUs, connect suppliers, map supplier costs, and create
              purchase orders from one operations workspace.
            </p>
            <Form method="post">
              <input type="hidden" name="intent" value="sync" />
              <button type="submit" disabled={isSyncing} style={primaryButtonStyle}>
                {isSyncing ? "Syncing inventory..." : "Sync Shopify inventory"}
              </button>
            </Form>
          </div>
          <div style={syncBoxStyle}>
            <div style={syncLabelStyle}>Last sync</div>
            <div style={syncValueStyle}>
              {data.lastSyncAt ? formatDateTime(data.lastSyncAt) : "Never synced"}
            </div>
            <div style={mutedStyle}>
              Read-only sync. PODesk does not change Shopify inventory in this MVP.
            </div>
          </div>
        </div>
        {actionData?.message ? (
          <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
        ) : null}
      </s-section>

      <s-section heading="Setup progress">
        <div style={stepGridStyle}>
          <SetupStep
            done={hasInventory}
            title="Sync products"
            text="Pull Shopify variants, inventory counts, and recent sales."
            href="/app"
          />
          <SetupStep
            done={hasSupplier}
            title="Add suppliers"
            text="Store supplier lead times, terms, notes, and contact details."
            href="/app/suppliers"
          />
          <SetupStep
            done={hasMapping}
            title="Map SKUs"
            text="Connect each Shopify SKU to the correct supplier and cost."
            href="/app/mappings"
          />
          <SetupStep
            done={hasImport}
            title="Stocky CSV import"
            text="Import suppliers and SKU mappings from CSV."
            href="/app/imports"
          />
          <SetupStep
            done={hasPo}
            title="Create a PO"
            text="Build a purchase order from real synced variants."
            href="/app/purchase-orders"
          />
        </div>
      </s-section>

      <s-section heading="Operations snapshot">
        <div style={metricGridStyle}>
          <Metric label="Variants synced" value={data.metrics.variantCount} />
          <Metric label="Inventory units" value={data.metrics.totalInventory} />
          <Metric label="Units sold, 30d" value={data.metrics.unitsSold30Days} />
          <Metric label="Suppliers" value={data.metrics.supplierCount} />
          <Metric label="Mapped SKUs" value={data.metrics.mappedSkuCount} />
          <Metric label="Open POs" value={data.metrics.openPurchaseOrderCount} />
        </div>
      </s-section>

      <s-section heading="Reorder attention">
        {data.atRiskVariants.length === 0 ? (
          <EmptyState
            title="No reorder risks yet"
            text="Sync inventory first. After products and recent sales are available, PODesk will show SKUs that may need supplier action."
            actionHref="/app/reorder"
            actionText="Open reorder planning"
          />
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
          <EmptyState
            title="No purchase orders yet"
            text="Once suppliers and SKU mappings exist, create your first draft purchase order."
            actionHref="/app/purchase-orders"
            actionText="Create purchase order"
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
                    <td style={tdStyle}>{po.status.replaceAll("_", " ")}</td>
                    <td style={tdStyle}>{po.lineCount}</td>
                    <td style={tdStyle}>
                      {po.totalOrdered > 0 ? `${po.totalReceived} / ${po.totalOrdered} received` : "-"}
                    </td>
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

function SetupStep({
  done,
  title,
  text,
  href,
}: {
  done: boolean;
  title: string;
  text: string;
  href: string;
}) {
  return (
    <a href={href} style={stepCardStyle}>
      <div style={stepStatusStyle(done)}>{done ? "Done" : "Next"}</div>
      <div style={stepTitleStyle}>{title}</div>
      <div style={mutedStyle}>{text}</div>
    </a>
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

  let productCount = 0;
  let variantCount = 0;
  let hasNextProductPage = true;
  let productCursor: string | null = null;
  let pageCount = 0;

  while (hasNextProductPage && pageCount < MAX_PRODUCT_PAGES) {
    const variables: Record<string, unknown> = {
      first: PRODUCTS_PER_PAGE,
      variantsFirst: PRODUCT_VARIANTS_PER_PRODUCT_LIMIT,
    };
    if (productCursor) variables.after = productCursor;

    const productData = await shopifyGraphql(admin, PRODUCTS_BASIC_QUERY, variables);
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
        const locationQuantities =
          "inventoryLevels" in variant.inventoryItem
            ? variant.inventoryItem.inventoryLevels.nodes
            : [];
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
    products: productCount,
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

// TODO: Implement Shopify Bulk Operations (bulkOperationRunQuery) or paginated nested variant queries for large products (100+ variants).
const PRODUCTS_BASIC_QUERY = `#graphql
  query PODeskProductsBasic($first: Int!, $after: String, $variantsFirst: Int!) {
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
        variants(first: $variantsFirst) {
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
          }
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

type InventoryLevelNode = {
  quantities: Array<{ name: string; quantity: number }>;
  location: { id: string; name: string; isActive: boolean };
};

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

const metricGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
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

const emptyStateStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "center",
  border: "1px solid #dfe3e8",
  borderRadius: "8px",
  padding: "14px",
  background: "#fff",
} as const;

const emptyTitleStyle = {
  fontWeight: 700,
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
  padding: "10px 8px",
  whiteSpace: "nowrap",
} as const;

const tdStyle = {
  borderBottom: "1px solid #f1f2f3",
  padding: "10px 8px",
  verticalAlign: "top",
} as const;

const primaryButtonStyle = {
  border: "0",
  borderRadius: "6px",
  padding: "10px 14px",
  background: "#008060",
  color: "#fff",
  fontWeight: 650,
  cursor: "pointer",
} as const;

const secondaryButtonStyle = {
  border: "1px solid #babfc3",
  borderRadius: "6px",
  padding: "9px 12px",
  background: "#fff",
  color: "#202223",
  fontWeight: 650,
  textDecoration: "none",
  whiteSpace: "nowrap",
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
