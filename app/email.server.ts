import { Resend } from "resend";
import nodemailer from "nodemailer";

export type PurchaseOrderForEmail = {
  reference: string;
  expectedArrival: string;
  notes: string | null;
  totalCost: number;
  currencyCode: string;
  supplierName: string;
  storeName: string;
  lines: Array<{
    sku: string;
    productTitle: string;
    variantTitle: string;
    quantity: number;
    unitCost: number | null;
    subtotal: number;
  }>;
};

function formatCurrency(amount: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

export function generatePurchaseOrderEmailHtml(po: PurchaseOrderForEmail) {
  const lineItemsHtml = po.lines
    .map(
      (line) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e1e3e5;">
        <div style="font-weight: 600;">${line.productTitle}</div>
        <div style="color: #6d7175; font-size: 13px;">${line.variantTitle}</div>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e1e3e5;">${line.sku || "-"}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e1e3e5; text-align: right;">${line.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e1e3e5; text-align: right;">${line.unitCost != null ? formatCurrency(line.unitCost, po.currencyCode) : "-"}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e1e3e5; text-align: right;">${formatCurrency(line.subtotal, po.currencyCode)}</td>
    </tr>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #202223; line-height: 1.5; padding: 20px; background-color: #f4f6f8; }
          .container { max-width: 800px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 8px; box-shadow: 0 0 0 1px rgba(63, 63, 68, 0.05), 0 1px 3px 0 rgba(63, 63, 68, 0.15); }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e1e3e5; }
          .title { font-size: 24px; font-weight: 700; margin: 0; }
          .info-grid { display: table; width: 100%; margin-bottom: 32px; }
          .info-col { display: table-cell; width: 50%; }
          .label { font-size: 13px; font-weight: 600; color: #6d7175; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
          .value { font-size: 15px; margin: 0 0 16px 0; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
          .th { padding: 12px; border-bottom: 2px solid #e1e3e5; text-align: left; font-size: 13px; font-weight: 600; color: #6d7175; text-transform: uppercase; letter-spacing: 0.5px; }
          .th.right { text-align: right; }
          .total-row { font-weight: 700; font-size: 16px; }
          .notes { background: #f9fafb; padding: 16px; border-radius: 4px; border-left: 4px solid #008060; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <h1 class="title">Purchase Order</h1>
              <div style="font-size: 16px; color: #6d7175; margin-top: 4px;">${po.reference}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 600; font-size: 18px;">${po.storeName}</div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-col">
              <div class="label">To Supplier</div>
              <p class="value">${po.supplierName}</p>
            </div>
            <div class="info-col">
              <div class="label">Expected Arrival</div>
              <p class="value">${po.expectedArrival || "Not specified"}</p>
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th class="th">Item</th>
                <th class="th">SKU</th>
                <th class="th right">Qty</th>
                <th class="th right">Unit Cost</th>
                <th class="th right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
              <tr>
                <td colspan="4" class="total-row" style="padding: 16px 12px; text-align: right; border-bottom: 2px solid #e1e3e5;">Total</td>
                <td class="total-row" style="padding: 16px 12px; text-align: right; border-bottom: 2px solid #e1e3e5;">${formatCurrency(po.totalCost, po.currencyCode)}</td>
              </tr>
            </tbody>
          </table>

          ${
            po.notes
              ? `
          <div class="notes">
            <div class="label" style="margin-bottom: 8px;">Notes & Instructions</div>
            <div style="white-space: pre-wrap;">${po.notes}</div>
          </div>
          `
              : ""
          }
        </div>
      </body>
    </html>
  `;
}

export async function sendPurchaseOrderEmail({
  recipientEmail,
  subject,
  htmlContent,
  provider,
  fromEmail,
  apiKey,
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPassword,
}: {
  recipientEmail: string;
  subject: string;
  htmlContent: string;
  provider: "SMTP" | "RESEND";
  fromEmail?: string | null;
  apiKey?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
}) {
  if (provider === "SMTP") {
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      throw new Error("SMTP credentials are incomplete. Please configure them in Settings.");
    }
    
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    });

    try {
      await transporter.sendMail({
        from: smtpUser,
        to: recipientEmail,
        subject: subject,
        html: htmlContent,
      });
    } catch (error: any) {
      throw new Error(`SMTP Error: ${error.message}`);
    }
  } else {
    // RESEND
    if (!apiKey) {
      throw new Error("Resend API Key is missing. Please configure it in Settings.");
    }
    if (!fromEmail) {
      throw new Error("Verified Sender Email is missing. Please configure it in Settings.");
    }

    const resend = new Resend(apiKey);

    const data = await resend.emails.send({
      from: fromEmail,
      to: recipientEmail,
      subject: subject,
      html: htmlContent,
    });

    if (data.error) {
      throw new Error(data.error.message);
    }
    
    return data;
  }
}
