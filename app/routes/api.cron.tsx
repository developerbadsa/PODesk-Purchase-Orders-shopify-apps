import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import prisma from "../db.server";
import { sendPurchaseOrderEmail } from "../email.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Simple check to prevent unauthorized execution (Vercel Cron sets a specific header, or we can use a token)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
    return new Response("Unauthorized", { status: 401 });
  }

  const results: any[] = [];
  const stores = await prisma.store.findMany({ include: { settings: true } });

  for (const store of stores) {
    if (!store.settings) continue;
    const settings = store.settings;

    // 1. Auto Reminders (DRAFT POs)
    if (settings.remindDraftPoDays && settings.remindDraftPoDays > 0) {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - settings.remindDraftPoDays);

      const draftPos = await prisma.purchaseOrder.findMany({
        where: {
          storeId: store.id,
          status: "DRAFT",
          updatedAt: { lt: thresholdDate },
          // Using followUpCount for drafts as well to avoid spamming
          followUpCount: 0,
        },
      });

      for (const po of draftPos) {
        // Send email to store owner
        if (settings.contactEmail) {
          const htmlContent = `
            <h2>Draft Purchase Order Reminder</h2>
            <p>You have a Purchase Order (<strong>${po.reference}</strong>) that has been in DRAFT status for over ${settings.remindDraftPoDays} days.</p>
            <p>Please review and send it to avoid inventory stockouts.</p>
          `;
          try {
            await sendPurchaseOrderEmail({
              recipientEmail: settings.contactEmail,
              subject: `Reminder: Draft PO ${po.reference} pending`,
              htmlContent,
              provider: settings.emailProvider,
              apiKey: settings.resendApiKey,
              fromEmail: settings.resendFromEmail,
              smtpHost: settings.smtpHost,
              smtpPort: settings.smtpPort,
              smtpUser: settings.smtpUser,
              smtpPassword: settings.smtpPassword,
            });
            await prisma.purchaseOrder.update({
              where: { id: po.id },
              data: { followUpCount: 1, lastFollowUpAt: new Date() },
            });
            results.push({ type: "DRAFT_REMINDER", poId: po.id });
          } catch (e) {
            console.error("Failed to send draft reminder", e);
          }
        }
      }
    }

    // 2. Auto Follow-up (SENT POs)
    if (settings.followUpSentPoDays && settings.followUpSentPoDays > 0 && settings.supplierEmailAutomationMode === "AUTO_SEND_AFTER_REVIEW") {
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - settings.followUpSentPoDays);

      const sentPos = await prisma.purchaseOrder.findMany({
        where: {
          storeId: store.id,
          status: "SENT",
          lastSentAt: { lt: thresholdDate },
          followUpCount: 0,
        },
        include: { supplier: true },
      });

      for (const po of sentPos) {
        const supplierEmail = po.supplierEmailSnapshot || po.supplier.email;
        if (supplierEmail) {
          const htmlContent = `
            <h2>Purchase Order Follow-up: ${po.reference}</h2>
            <p>Hello ${po.supplier.name},</p>
            <p>We are following up on Purchase Order <strong>${po.reference}</strong> which was sent to you on ${po.lastSentAt?.toISOString().slice(0, 10)}.</p>
            <p>Could you please provide an estimated arrival date or confirm if the order is being processed?</p>
            <p>Thank you.</p>
          `;
          try {
            await sendPurchaseOrderEmail({
              recipientEmail: supplierEmail,
              subject: `Follow-up: Purchase Order ${po.reference}`,
              htmlContent,
              provider: settings.emailProvider,
              apiKey: settings.resendApiKey,
              fromEmail: settings.resendFromEmail,
              smtpHost: settings.smtpHost,
              smtpPort: settings.smtpPort,
              smtpUser: settings.smtpUser,
              smtpPassword: settings.smtpPassword,
            });
            await prisma.purchaseOrder.update({
              where: { id: po.id },
              data: { followUpCount: { increment: 1 }, lastFollowUpAt: new Date() },
            });
            results.push({ type: "SUPPLIER_FOLLOWUP", poId: po.id });
          } catch (e) {
            console.error("Failed to send supplier follow-up", e);
          }
        }
      }
    }

    // 3. Recurring POs
    const today = new Date();
    const recurringPos = await prisma.purchaseOrder.findMany({
      where: {
        storeId: store.id,
        isRecurring: true,
        nextRecurringDate: { lte: today },
      },
      include: { lines: true },
    });

    for (const po of recurringPos) {
      if (po.recurringIntervalDays && po.recurringIntervalDays > 0) {
        try {
          const newRef = `PO-${Math.floor(Math.random() * 1000000)}`;
          await prisma.purchaseOrder.create({
            data: {
              storeId: store.id,
              supplierId: po.supplierId,
              reference: newRef,
              notes: po.notes,
              lines: {
                create: po.lines.map((l) => ({
                  variantId: l.variantId,
                  quantity: l.quantity,
                  unitCost: l.unitCost,
                })),
              },
            },
          });
          
          // Update the template's next date
          const nextDate = new Date(po.nextRecurringDate!);
          nextDate.setDate(nextDate.getDate() + po.recurringIntervalDays);
          await prisma.purchaseOrder.update({
            where: { id: po.id },
            data: { nextRecurringDate: nextDate },
          });

          results.push({ type: "RECURRING_GENERATED", templatePoId: po.id, newRef });
        } catch (e) {
          console.error("Failed to generate recurring PO", e);
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return loader({ request } as LoaderFunctionArgs);
};
