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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await getOrCreateStore(session.shop);

  const [
    variantCount,
    supplierCount,
    openPurchaseOrderCount,
    atRiskVariants,
    recentPurchaseOrders,
    suppliers,
  ] = await Promise.all([
    prisma.shopifyVariant.count({ where: { storeId: store.id } }),
    prisma.supplier.count({ where: { storeId: store.id } }),
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
    prisma.supplier.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 20,
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
    suppliers,
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

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const store = await getOrCreateStore(session.shop);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "sync") {
    const synced = await syncShopifyInventory(admin, store.id);
    return {
      ok: true,
      message: `Synced ${synced.products} products, ${synced.variants} variants, and ${synced.locations} locations.`,
    } satisfies ActionData;
  }

  if (intent === "create-supplier") {
    const name = String(formData.get("name") || "").trim();

    if (!name) {
      return { ok: false, message: "Supplier name is required." } satisfies ActionData;
    }

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

  if (intent === "create-po") {
    const supplierId = String(formData.get("supplierId") || "");
    const sku = String(formData.get("sku") || "").trim();
    const quantity = numberFromForm(formData.get("quantity"), 0);

    if (!supplierId || !sku || quantity <= 0) {
      return {
        ok: false,
        message: "Supplier, SKU, and quantity are required for a PO.",
      } satisfies ActionData;
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, storeId: store.id },
    });
    const variant = await prisma.shopifyVariant.findFirst({
      where: { storeId: store.id, sku },
    });

    if (!supplier) {
      return { ok: false, message: "Supplier not found." } satisfies ActionData;
    }

    if (!variant) {
      return {
        ok: false,
        message: "SKU not found. Sync Shopify data first or check the SKU.",
      } satisfies ActionData;
    }

    const reference = `RP-${Date.now()}`;
    await prisma.purchaseOrder.create({
      data: {
        storeId: store.id,
        supplierId,
        reference,
        expectedArrival: dateFromForm(formData.get("expectedArrival")),
        notes: optionalString(formData.get("notes")),
        lines: {
          create: {
            variantId: variant.id,
            quantity,
            unitCost: optionalNumber(formData.get("unitCost")),
          },
        },
      },
    });

    return { ok: true, message: `Purchase order ${reference} created.` } satisfies ActionData;
  }

  return { ok: false, message: "Unknown action." } satisfies ActionData;
};

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page heading="PODesk">
      <s-section heading="Stocky Rescue">
        <s-paragraph>
          Keep suppliers, purchase orders, and reorder decisions running while
          moving away from Stocky. This first build reads Shopify inventory,
          calculates basic stockout risk, and creates simple purchase orders.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <Form method="post">
            <input type="hidden" name="intent" value="sync" />
            <button type="submit" disabled={isSubmitting} style={buttonStyle}>
              {isSubmitting ? "Syncing..." : "Sync Shopify inventory"}
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

      <s-section heading="Add supplier">
        <Form method="post">
          <input type="hidden" name="intent" value="create-supplier" />
          <div style={formGridStyle}>
            <Field label="Supplier name" name="name" required />
            <Field label="Email" name="email" type="email" />
            <Field label="Phone" name="phone" />
            <Field label="Lead time days" name="leadTimeDays" type="number" defaultValue="14" />
            <Field label="Minimum order" name="minimumOrder" type="number" />
            <Field label="Payment terms" name="paymentTerms" />
          </div>
          <label style={fieldLabelStyle}>
            Notes
            <textarea name="notes" rows={3} style={textareaStyle} />
          </label>
          <button type="submit" disabled={isSubmitting} style={buttonStyle}>
            Save supplier
          </button>
        </Form>
      </s-section>

      <s-section heading="Create purchase order">
        {data.suppliers.length === 0 ? (
          <s-paragraph>Add a supplier before creating a purchase order.</s-paragraph>
        ) : (
          <Form method="post">
            <input type="hidden" name="intent" value="create-po" />
            <div style={formGridStyle}>
              <label style={fieldLabelStyle}>
                Supplier
                <select name="supplierId" required style={inputStyle}>
                  <option value="">Select supplier</option>
                  {data.suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="SKU" name="sku" required />
              <Field label="Quantity" name="quantity" type="number" required />
              <Field label="Unit cost" name="unitCost" type="number" step="0.01" />
              <Field label="Expected arrival" name="expectedArrival" type="date" />
            </div>
            <label style={fieldLabelStyle}>
              Notes
              <textarea name="notes" rows={3} style={textareaStyle} />
            </label>
            <button type="submit" disabled={isSubmitting} style={buttonStyle}>
              Create PO
            </button>
          </Form>
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
                    <td style={tdStyle}>{po.reference}</td>
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

function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  step?: string;
}) {
  return (
    <label style={fieldLabelStyle}>
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        step={step}
        style={inputStyle}
      />
    </label>
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
  const orderQuery = `created_at:>=${thirtyDaysAgoIsoDate()}`;
  const response = await admin.graphql(
    `#graphql
      query PODeskInitialSync($orderQuery: String!) {
        locations(first: 25) {
          nodes {
            id
            name
            isActive
          }
        }
        products(first: 50) {
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
        orders(first: 100, query: $orderQuery, sortKey: CREATED_AT, reverse: true) {
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
      }`,
    { variables: { orderQuery } },
  );

  const payload = (await response.json()) as {
    data?: ShopifySyncPayload;
    errors?: unknown;
  };

  if (!payload.data) {
    throw new Error(`Shopify sync failed: ${JSON.stringify(payload.errors ?? {})}`);
  }

  const soldByVariant = new Map<string, number>();
  for (const order of payload.data.orders.nodes) {
    for (const lineItem of order.lineItems.nodes) {
      const variantId = lineItem.variant?.id;
      if (!variantId) continue;
      soldByVariant.set(variantId, (soldByVariant.get(variantId) ?? 0) + lineItem.quantity);
    }
  }

  let products = 0;
  let variants = 0;
  const syncedLocationIds = new Set<string>();

  for (const location of payload.data.locations.nodes) {
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

  for (const product of payload.data.products.nodes) {
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
    products += 1;

    for (const variant of product.variants.nodes) {
      const locationQuantities = variant.inventoryItem.inventoryLevels.nodes;
      const availableFromLocations = locationQuantities.reduce(
        (total, level) => total + availableQuantity(level.quantities),
        0,
      );
      const inventoryQuantity =
        locationQuantities.length > 0 ? availableFromLocations : variant.inventoryQuantity;
      const unitsSold30Days = soldByVariant.get(variant.id) ?? 0;
      const averageDailySales = unitsSold30Days / SALES_WINDOW_DAYS;
      const daysUntilStockout =
        averageDailySales > 0 ? inventoryQuantity / averageDailySales : null;

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
          unitsSold30Days,
          averageDailySales,
          daysUntilStockout,
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
          unitsSold30Days,
          averageDailySales,
          daysUntilStockout,
        },
      });
      variants += 1;

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

  await prisma.store.update({
    where: { id: storeId },
    data: { lastSyncAt: new Date() },
  });

  return { products, variants, locations: syncedLocationIds.size };
}

function availableQuantity(quantities: Array<{ name: string; quantity: number }>) {
  return quantities.find((quantity) => quantity.name === "available")?.quantity ?? 0;
}

function optionalString(value: FormDataEntryValue | null) {
  const stringValue = String(value || "").trim();
  return stringValue.length > 0 ? stringValue : null;
}

function numberFromForm(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const stringValue = String(value || "").trim();
  if (!stringValue) return null;
  const parsed = Number(stringValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalFloat(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateFromForm(value: FormDataEntryValue | null) {
  const stringValue = String(value || "").trim();
  return stringValue ? new Date(`${stringValue}T00:00:00.000Z`) : null;
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

type ShopifySyncPayload = {
  locations: {
    nodes: Array<{
      id: string;
      name: string;
      isActive: boolean;
    }>;
  };
  products: {
    nodes: Array<{
      id: string;
      title: string;
      handle: string | null;
      status: string;
      vendor: string | null;
      variants: {
        nodes: Array<{
          id: string;
          title: string;
          sku: string | null;
          barcode: string | null;
          inventoryQuantity: number;
          inventoryItem: {
            id: string;
            tracked: boolean;
            unitCost: { amount: string; currencyCode: string } | null;
            inventoryLevels: {
              nodes: Array<{
                id: string;
                quantities: Array<{ name: string; quantity: number }>;
                location: {
                  id: string;
                  name: string;
                  isActive: boolean;
                };
              }>;
            };
          };
        }>;
      };
    }>;
  };
  orders: {
    nodes: Array<{
      id: string;
      lineItems: {
        nodes: Array<{
          quantity: number;
          variant: { id: string } | null;
        }>;
      };
    }>;
  };
};

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

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
  marginBottom: "12px",
} as const;

const fieldLabelStyle = {
  display: "grid",
  gap: "6px",
  color: "#202223",
  fontSize: "13px",
  fontWeight: 600,
} as const;

const inputStyle = {
  border: "1px solid #c9cccf",
  borderRadius: "6px",
  padding: "9px 10px",
  fontSize: "14px",
  width: "100%",
} as const;

const textareaStyle = {
  ...inputStyle,
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
