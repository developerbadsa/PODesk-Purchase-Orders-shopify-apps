import { useEffect } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { shopifyBoundaryError } from "../shopify-boundary";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";
import { formatCurrency } from "../utils";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "purchase-order-print-loader");
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) throw new Response("Store not found", { status: 404 });

  const [settings, po] = await Promise.all([
    prisma.storeSettings.findUnique({ where: { storeId: store.id } }),
    prisma.purchaseOrder.findFirst({
      where: { id: params.id, storeId: store.id },
      include: {
        supplier: true,
        lines: true, // SIMPLIFIED: Fetch shallow lines first for performance.
        receipts: {
          include: { lines: true },
          orderBy: { receivedAt: "desc" },
        },
      },
    }),
  ]);

  if (!po) throw new Response("Purchase order not found", { status: 404 });

  // --- Performance Optimization: Hydrate Line Items ---
  // Instead of one deeply nested query, we fetch relations in batches.
  const variantIds = po.lines.map((line) => line.variantId);
  const lineIds = po.lines.map((line) => line.id);

  const [variants, allReceiptLinesForPo] = await Promise.all([
    // Fetch all variants and their parent products in one go.
    prisma.shopifyVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true },
    }),
    // Fetch all receipt lines for all PO lines in one go.
    prisma.purchaseOrderReceiptLine.findMany({
      where: { purchaseOrderLineId: { in: lineIds } },
    }),
  ]);

  // Create lookup maps for efficient data-stitching.
  const variantsMap = new Map(variants.map((v) => [v.id, v]));
  const receiptLinesMap = allReceiptLinesForPo.reduce((map, rl) => {
    const lines = map.get(rl.purchaseOrderLineId) || [];
    lines.push(rl);
    map.set(rl.purchaseOrderLineId, lines);
    return map;
  }, new Map<string, any[]>());

  // "Hydrate" the original PO lines with the fetched relational data.
  const hydratedLines = po.lines.map((line) => ({
    ...line,
    variant: variantsMap.get(line.variantId)!,
    receiptLines: receiptLinesMap.get(line.id) || [],
  }));

  const lineDataMap = new Map(
    hydratedLines.map((line) => [
      line.id,
      {
        sku: line.variant.sku || "-",
        productTitle: line.variant.product.title,
        variantTitle: line.variant.title,
      },
    ])
  );
  const totalQuantity = hydratedLines.reduce((sum, l) => sum + l.quantity, 0);
  const totalReceived = hydratedLines.reduce(
    (sum, l) => sum + l.receiptLines.reduce((rSum, rl) => rSum + rl.quantityReceived, 0),
    0
  );
  const totalRemaining = Math.max(0, totalQuantity - totalReceived);
  const receiveProgressPercent =
    totalQuantity > 0 ? Math.min(100, Math.round((totalReceived / totalQuantity) * 100)) : 0;
  const totalCost = hydratedLines.reduce((sum, l) => sum + (l.unitCost ?? 0) * l.quantity, 0);
  const currencyCode = settings?.currencyCode || "USD";

  const companyAddressParts = [
    settings?.addressLine1,
    settings?.addressLine2,
    [settings?.city, settings?.region, settings?.postalCode].filter(Boolean).join(", "),
    settings?.country,
  ].filter(Boolean);

  const receiptHistory = po.receipts.map((r) => ({
    id: r.id,
    receivedAt: r.receivedAt.toISOString(),
    notes: r.notes,
    totalQuantity: r.lines.reduce((sum, rl) => sum + rl.quantityReceived, 0),
    lines: r.lines.map((rl) => {
      const lineInfo = lineDataMap.get(rl.purchaseOrderLineId);
      return {
        id: rl.id,
        sku: lineInfo?.sku || "-",
        productTitle: lineInfo?.productTitle || "Unknown Product",
        variantTitle: lineInfo?.variantTitle || "Unknown Variant",
        quantityReceived: rl.quantityReceived,
      };
    }),
  }));

  return {
    shopDomain: store.shop,
    currencyCode,
    company: {
      name: settings?.companyName || store.name || store.shop,
      email: settings?.contactEmail,
      phone: settings?.phone,
      addressLines: companyAddressParts,
      defaultPaymentTerms: settings?.defaultPaymentTerms,
    },
    po: {
      id: po.id,
      reference: po.reference,
      status: po.status,
      expectedArrival: po.expectedArrival ? po.expectedArrival.toISOString() : null,
      notes: po.notes,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
      lastSentAt: po.lastSentAt ? po.lastSentAt.toISOString() : null,
      sentCount: po.sentCount,
      supplier: {
        name: po.supplier.name,
        email: po.supplierEmailSnapshot || po.supplier.email,
        phone: po.supplier.phone,
        paymentTerms: po.supplier.paymentTerms || settings?.defaultPaymentTerms || null,
        notes: po.supplier.notes,
      },
      lines: hydratedLines.map((l) => {
        const received = l.receiptLines.reduce((sum, rl) => sum + rl.quantityReceived, 0);
        return {
          id: l.id,
          productTitle: l.variant.product.title,
          variantTitle: l.variant.title,
          sku: l.variant.sku,
          quantity: l.quantity,
          receivedQuantity: received,
          remainingQuantity: Math.max(0, l.quantity - received),
          unitCost: l.unitCost,
          subtotal: (l.unitCost ?? 0) * l.quantity,
        };
      }),
      totalQuantity,
      totalReceived,
      totalRemaining,
      receiveProgressPercent,
      totalCost,
    },
    receiptHistory,
  };
};

export default function PurchaseOrderPrintPage() {
  const { currencyCode, company, po, receiptHistory } = useLoaderData<typeof loader>();

  // Auto-trigger print dialog when the print page loads (works in iframe context)
  useEffect(() => {
    const timer = setTimeout(() => {
      window.print();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleDownloadPdf = async () => {
    const element = document.getElementById("document-sheet"); // Assuming your main content is wrapped in this ID
    if (element) {
      const { default: html2pdf } = await import("html2pdf.js");
      html2pdf().set({
        margin: [10, 10, 10, 10], // Top, Left, Bottom, Right
        filename: `purchase-order-${po.reference}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, logging: true, dpi: 192, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(element).save();
    }
  };

  return (
    <div style={containerStyle}>
      <style>{printStyles}</style>

      {/* Action Bar - Screen Only */}
      <div className="no-print" style={actionBarContainerStyle}>
        <Link to={`/app/purchase-orders/${po.id}`} style={backButtonStyle}>
          &larr; Back to PO
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          style={printButtonStyle}
        >
          Print
        </button>
        <button
          type="button"
          onClick={handleDownloadPdf}
          style={{ ...printButtonStyle, marginLeft: "10px", backgroundColor: "#005040" }} // Slightly different color for distinction
        >
          Download PDF
        </button>
      </div>

      {/* Document Sheet */}
      {/* Added ID for html2pdf.js to target */}
      <div style={documentSheetStyle}>
        {/* Document Header */}
        <header style={headerStyle}>
          <div>
            <div style={brandStyle}>PURCHASE ORDER</div>
            <h1 style={titleStyle}>{po.reference}</h1>
            <div style={companyNameStyle}>{company.name}</div>
            {company.addressLines.map((line, i) => (
              <div key={i} style={companyMetaStyle}>{line}</div>
            ))}
            {company.email && <div style={companyMetaStyle}>Email: {company.email}</div>}
            {company.phone && <div style={companyMetaStyle}>Phone: {company.phone}</div>}
          </div>
          <div style={headerRightStyle}>
            <span style={statusBadgeStyle(po.status)}>
              {po.status.replaceAll("_", " ")}
            </span>
            <div style={dateMetaStyle}>
              <div>
                <strong>Created:</strong> {formatDate(po.createdAt)}
              </div>
              <div>
                <strong>Last updated:</strong> {formatDate(po.updatedAt)}
              </div>
              {po.expectedArrival && (
                <div>
                  <strong>Expected:</strong> {formatDate(po.expectedArrival)}
                </div>
              )}
              {po.lastSentAt && (
                <div>
                  <strong>Last sent:</strong> {formatDate(po.lastSentAt)} ({po.sentCount}x)
                </div>
              )}
            </div>
          </div>
        </header>

        <hr style={dividerStyle} />

        {/* Details Grid */}
        <div style={detailsGridStyle}>
          {/* Supplier Info */}
          <div style={infoBlockStyle}>
            <h3 style={sectionHeadingStyle}>Vendor / Supplier</h3>
            <div style={infoRowStyle}>
              <strong>Name:</strong> {po.supplier.name}
            </div>
            {po.supplier.email && (
              <div style={infoRowStyle}>
                <strong>Email:</strong> {po.supplier.email}
              </div>
            )}
            {po.supplier.phone && (
              <div style={infoRowStyle}>
                <strong>Phone:</strong> {po.supplier.phone}
              </div>
            )}
            {po.supplier.paymentTerms && (
              <div style={infoRowStyle}>
                <strong>Payment Terms:</strong> {po.supplier.paymentTerms}
              </div>
            )}
            {po.supplier.notes && (
              <div style={infoRowStyle}>
                <strong>Supplier Notes:</strong> {po.supplier.notes}
              </div>
            )}
          </div>

          {/* Order Meta / Notes */}
          <div style={infoBlockStyle}>
            <h3 style={sectionHeadingStyle}>Order Notes & Info</h3>
            <div style={infoRowStyle}>
              <strong>PO Ref:</strong> {po.reference}
            </div>
            {po.notes ? (
              <div style={{ ...infoRowStyle, marginTop: "6px", whiteSpace: "pre-wrap" }}>
                <strong>Notes:</strong> {po.notes}
              </div>
            ) : (
              <div style={{ ...infoRowStyle, color: "#6b7280" }}>No notes provided.</div>
            )}
          </div>
        </div>

        {/* Receiving Summary */}
        <div style={{ ...infoBlockStyle, marginBottom: "24px" }}>
          <h3 style={sectionHeadingStyle}>Receiving Summary</h3>
          {po.totalReceived === 0 ? (
            <div style={{ fontSize: "13px", color: "#6b7280" }}>No items received yet.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", fontSize: "13px" }}>
              <div><strong>Ordered:</strong> {po.totalQuantity}</div>
              <div><strong>Received:</strong> {po.totalReceived}</div>
              <div><strong>Remaining:</strong> {po.totalRemaining}</div>
              <div><strong>Progress:</strong> {po.receiveProgressPercent}%</div>
              <div><strong>Status:</strong> {po.status.replaceAll("_", " ")}</div>
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <div style={tableSectionStyle}>
          <h3 style={sectionHeadingStyle}>Line Items ({po.lines.length})</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Product & Variant</th>
                <th style={thStyle}>SKU</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Ordered</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Received</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Remaining</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Unit Cost</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line, idx) => (
                <tr key={line.id}>
                  <td style={tdStyle}>{idx + 1}</td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{line.productTitle}</div>
                    {line.variantTitle && line.variantTitle !== "Default Title" && (
                      <div style={subTitleStyle}>{line.variantTitle}</div>
                    )}
                  </td>
                  <td style={tdStyle}>{line.sku || "-"}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{line.quantity}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{line.receivedQuantity}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{line.remainingQuantity}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {line.unitCost != null ? formatCurrency(line.unitCost, currencyCode) : "-"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {line.subtotal > 0 ? formatCurrency(line.subtotal, currencyCode) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ ...tfStyle, fontWeight: 700 }}>
                  Total
                </td>
                <td style={{ ...tfStyle, textAlign: "right", fontWeight: 700 }}>
                  {po.totalQuantity}
                </td>
                <td style={{ ...tfStyle, textAlign: "right", fontWeight: 700 }}>
                  {po.totalReceived}
                </td>
                <td style={{ ...tfStyle, textAlign: "right", fontWeight: 700 }}>
                  {po.totalRemaining}
                </td>
                <td style={tfStyle}></td>
                <td style={{ ...tfStyle, textAlign: "right", fontWeight: 700 }}>
                  {po.totalCost > 0 ? formatCurrency(po.totalCost, currencyCode) : "-"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Receipt History Log */}
        {receiptHistory.length > 0 ? (
          <div style={{ ...tableSectionStyle, marginTop: "24px" }}>
            <h3 style={sectionHeadingStyle}>Receipt History ({receiptHistory.length})</h3>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Items Received</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Total Qty</th>
                  <th style={thStyle}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {receiptHistory.map((receipt) => (
                  <tr key={receipt.id}>
                    <td style={tdStyle}>{formatDate(receipt.receivedAt)}</td>
                    <td style={tdStyle}>
                      {receipt.lines.map((rl) => (
                        <div key={rl.id} style={{ fontSize: "12px" }}>
                          {rl.productTitle} - {rl.variantTitle} {rl.sku !== "-" ? `(${rl.sku})` : ""}: <strong>+{rl.quantityReceived}</strong>
                        </div>
                      ))}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                      +{receipt.totalQuantity}
                    </td>
                    <td style={tdStyle}>{receipt.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Print Document Footer */}
        <footer style={footerStyle}>
          <div>Generated by PODesk Purchase Orders</div>
          <div>Page 1 of 1</div>
        </footer>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function statusBadgeStyle(status: string) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    DRAFT: { bg: "#f3f4f6", color: "#4b5563", border: "#d1d5db" },
    SENT: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    CONFIRMED: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
    PARTIALLY_RECEIVED: { bg: "#fffbe6", color: "#b45309", border: "#fde68a" },
    RECEIVED: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
    DELAYED: { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
    CANCELLED: { bg: "#f3f4f6", color: "#4b5563", border: "#d1d5db" },
  };
  const c = colors[status] ?? { bg: "#f3f4f6", color: "#4b5563", border: "#d1d5db" };
  return {
    background: c.bg,
    color: c.color,
    border: `1px solid ${c.border}`,
    padding: "4px 10px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    display: "inline-block",
    textTransform: "uppercase",
  } as const;
}

const printStyles = `
@media print {
  body {
    background: #ffffff !important;
    color: #000000 !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .no-print {
    display: none !important;
  }
  @page {
    size: A4 portrait;
    margin: 12mm;
  }
  table {
    page-break-inside: auto;
  }
  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
}
`;

const containerStyle = {
  minHeight: "100vh",
  backgroundColor: "#f4f6f8",
  padding: "20px",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'San Francisco', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  color: "#1a1a1a",
} as const;

const actionBarContainerStyle = {
  maxWidth: "800px",
  margin: "0 auto 16px auto",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
} as const;

const backButtonStyle = {
  display: "inline-flex",
  alignItems: "center",
  color: "#2c6ecb",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: "14px",
} as const;

const printButtonStyle = {
  backgroundColor: "#008060",
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "8px 16px",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
} as const;

const documentSheetStyle = {
  maxWidth: "800px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  padding: "36px 40px",
  borderRadius: "8px",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  border: "1px solid #dfe3e8",
} as const;

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "16px",
} as const;

const brandStyle = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "1px",
  color: "#6d7175",
  marginBottom: "4px",
} as const;

const titleStyle = {
  margin: "0 0 4px 0",
  fontSize: "24px",
  fontWeight: 700,
  color: "#1a1a1a",
} as const;



const companyNameStyle = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#1a1a1a",
  marginBottom: "2px",
} as const;

const companyMetaStyle = {
  fontSize: "13px",
  color: "#4b5563",
  lineHeight: "1.3",
} as const;

const headerRightStyle = {
  textAlign: "right",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: "8px",
} as const;

const dateMetaStyle = {
  fontSize: "13px",
  color: "#303030",
  lineHeight: "1.4",
} as const;

const dividerStyle = {
  border: "none",
  borderTop: "1px solid #e1e3e5",
  margin: "16px 0 24px 0",
} as const;

const detailsGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "24px",
  marginBottom: "24px",
} as const;

const infoBlockStyle = {
  backgroundColor: "#f9fafb",
  padding: "16px",
  borderRadius: "6px",
  border: "1px solid #e5e7eb",
} as const;

const sectionHeadingStyle = {
  margin: "0 0 10px 0",
  fontSize: "13px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  color: "#4b5563",
} as const;

const infoRowStyle = {
  fontSize: "13px",
  color: "#1f2937",
  marginBottom: "4px",
  wordBreak: "break-word",
} as const;

const tableSectionStyle = {
  marginBottom: "24px",
} as const;

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "13px",
  textAlign: "left",
} as const;

const thStyle = {
  padding: "8px",
  textAlign: "left" as const,
  borderBottom: "1px solid #e5e7eb",
  color: "#4b5563",
  fontSize: "12px",
  fontWeight: 600,
};

const tdStyle = {
  padding: "8px",
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "top",
  fontSize: "12px",
  lineHeight: "1.4",
};

const tfStyle = {
  padding: "10px 8px",
  fontSize: "13px",
  fontWeight: 700,
  borderTop: "2px solid #374151",
  borderBottom: "2px solid #374151",
};

const subTitleStyle = {
  color: "#6b7280",
  fontSize: "12px",
  marginTop: "2px",
} as const;

const footerStyle = {
  marginTop: "32px",
  paddingTop: "12px",
  borderTop: "1px solid #e5e7eb",
  display: "flex",
  justifyContent: "space-between",
  fontSize: "11px",
  color: "#9ca3af",
} as const;

// Shopify requires ErrorBoundary on every route that calls authenticate.admin
// so that thrown 200/401 responses (App Bridge re-auth) are handled correctly.
export function ErrorBoundary() {
  const error = useRouteError();
  const shopifyError = shopifyBoundaryError(error);
  if (shopifyError) return shopifyError;

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
