import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) throw new Response("Store not found", { status: 404 });

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, storeId: store.id },
    include: {
      supplier: true,
      lines: {
        include: {
          variant: { include: { product: true } },
        },
      },
    },
  });

  if (!po) throw new Response("Purchase order not found", { status: 404 });

  const totalQuantity = po.lines.reduce((sum, l) => sum + l.quantity, 0);
  const totalCost = po.lines.reduce((sum, l) => sum + (l.unitCost ?? 0) * l.quantity, 0);

  return {
    shopDomain: store.name ? `${store.name} (${store.shop})` : store.shop,
    po: {
      id: po.id,
      reference: po.reference,
      status: po.status,
      expectedArrival: po.expectedArrival ? po.expectedArrival.toISOString() : null,
      notes: po.notes,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
      supplier: {
        name: po.supplier.name,
        email: po.supplier.email,
        phone: po.supplier.phone,
        paymentTerms: po.supplier.paymentTerms,
        notes: po.supplier.notes,
      },
      lines: po.lines.map((l) => ({
        id: l.id,
        productTitle: l.variant.product.title,
        variantTitle: l.variant.title,
        sku: l.variant.sku,
        quantity: l.quantity,
        unitCost: l.unitCost,
        subtotal: (l.unitCost ?? 0) * l.quantity,
      })),
      totalQuantity,
      totalCost,
    },
  };
};

export default function PurchaseOrderPrintPage() {
  const { shopDomain, po } = useLoaderData<typeof loader>();

  return (
    <div style={containerStyle}>
      <style>{printStyles}</style>

      {/* Action Bar - Screen Only */}
      <div className="no-print" style={actionBarContainerStyle}>
        <a href={`/app/purchase-orders/${po.id}`} style={backButtonStyle}>
          &larr; Back to PO
        </a>
        <button
          type="button"
          onClick={() => window.print()}
          style={printButtonStyle}
        >
          Print PO
        </button>
      </div>

      {/* Document Sheet */}
      <div style={documentSheetStyle}>
        {/* Document Header */}
        <header style={headerStyle}>
          <div>
            <div style={brandStyle}>PODesk Purchase Order</div>
            <h1 style={titleStyle}>{po.reference}</h1>
            <div style={storeDomainStyle}>{shopDomain}</div>
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

        {/* Line Items Table */}
        <div style={tableSectionStyle}>
          <h3 style={sectionHeadingStyle}>Line Items ({po.lines.length})</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Product & Variant</th>
                <th style={thStyle}>SKU</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Qty</th>
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
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {line.unitCost != null ? `$${line.unitCost.toFixed(2)}` : "-"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {line.subtotal > 0 ? `$${line.subtotal.toFixed(2)}` : "-"}
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
                <td style={tfStyle}></td>
                <td style={{ ...tfStyle, textAlign: "right", fontWeight: 700 }}>
                  {po.totalCost > 0 ? `$${po.totalCost.toFixed(2)}` : "-"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Print Document Footer */}
        <footer style={footerStyle}>
          <div>Generated via PODesk Purchase Orders</div>
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

const storeDomainStyle = {
  fontSize: "13px",
  color: "#6d7175",
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
  borderBottom: "2px solid #374151",
  padding: "8px 10px",
  fontWeight: 700,
  color: "#111827",
  backgroundColor: "#f9fafb",
} as const;

const tdStyle = {
  borderBottom: "1px solid #e5e7eb",
  padding: "10px 10px",
  verticalAlign: "top",
  color: "#1f2937",
  wordBreak: "break-word",
} as const;

const tfStyle = {
  borderTop: "2px solid #374151",
  borderBottom: "2px solid #374151",
  padding: "10px 10px",
  color: "#111827",
  fontSize: "13px",
} as const;

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

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
