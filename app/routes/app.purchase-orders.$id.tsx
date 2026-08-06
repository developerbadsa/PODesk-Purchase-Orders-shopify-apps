import { useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  redirect,
  isRouteErrorResponse,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteError,
  Form,
  useSubmit,
} from "react-router";
import type { PurchaseOrderStatus } from "@prisma/client";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";
import { createUniquePoReference } from "../po.server";
import { formatCurrency } from "../utils";
import { calculateLineReceiving, getPoReceivingSummary } from "../receiving.server";
import { SearchableSelect } from "../components/SearchableSelect";
import { DatePickerField } from "../components/DatePickerField";
import {
  Button,
  buttonPrimaryStyle,
  buttonSecondaryStyle,
  buttonDangerStyle,
  buttonSmallStyle,
} from "../components/Button";

type ActionData = { ok: boolean; message: string };

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["CONFIRMED", "DELAYED", "CANCELLED"],
  CONFIRMED: ["PARTIALLY_RECEIVED", "RECEIVED", "DELAYED", "CANCELLED"],
  PARTIALLY_RECEIVED: ["RECEIVED", "DELAYED"],
  DELAYED: ["CONFIRMED", "RECEIVED", "CANCELLED"],
  RECEIVED: [],
  CANCELLED: [],
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "purchase-order-detail-loader");
  const store = await prisma.store.findUnique({ where: { shop: session.shop } });
  if (!store) throw new Response("Store not found", { status: 404 });

  const [settings, po, variants] = await Promise.all([
    prisma.storeSettings.findUnique({ where: { storeId: store.id } }),
    prisma.purchaseOrder.findFirst({
      where: { id: params.id, storeId: store.id },
      include: {
        supplier: true,
        lines: {
          include: {
            variant: { include: { product: true } },
            receiptLines: true,
          },
        },
        receipts: {
          include: {
            lines: {
              include: {
                purchaseOrderLine: {
                  include: {
                    variant: { include: { product: true } },
                  },
                },
              },
            },
          },
          orderBy: { receivedAt: "desc" },
        },
      },
    }),
    // Only load variants with mappings for the add-line-item picker.
    prisma.shopifyVariant.findMany({
      where: {
        storeId: store.id,
        supplierMappings: { some: { storeId: store.id } },
      },
      select: {
        id: true,
        title: true,
        sku: true,
        unitCostAmount: true,
        product: { select: { title: true } },
      },
      orderBy: [{ product: { title: "asc" } }, { title: "asc" }],
      take: 1000,
    }),
  ]);

  if (!po) throw new Response("Purchase order not found", { status: 404 });

  const variantIds = po.lines.map(l => l.variantId);
  const [mappings, duplicateLines] = await Promise.all([
    prisma.supplierVariantMapping.findMany({
      where: { storeId: store.id, supplierId: po.supplierId, variantId: { in: variantIds } },
      select: { supplierId: true, variantId: true, supplierCost: true },
    }),
    prisma.purchaseOrderLine.findMany({
      where: {
        variantId: { in: variantIds },
        purchaseOrder: {
          storeId: store.id,
          id: { not: po.id },
          status: { in: ["DRAFT", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "DELAYED"] },
        },
      },
      include: {
        purchaseOrder: { select: { id: true, reference: true, status: true, supplier: { select: { name: true } } } },
        variant: { select: { title: true, sku: true, product: { select: { title: true } } } },
      },
    }),
  ]);

  const currencyCode = settings?.currencyCode || "USD";
  const companyName = settings?.companyName || store.name || store.shop;
  const supplierEmail = po.supplierEmailSnapshot || po.supplier.email || "";
  const defaultSubject = `Purchase Order ${po.reference} from ${companyName}`;
  const arrivalFormatted = po.expectedArrival
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(po.expectedArrival)
    : "Not set";
  const defaultMessage = `Hello ${po.supplier.name},\n\nPlease find purchase order ${po.reference} below.\n\nExpected arrival: ${arrivalFormatted}\n\nThank you.`;

  // Line receiving calculations
  const processedLines = po.lines.map((l) => {
    const calc = calculateLineReceiving(l);

    return {
      id: l.id,
      variantId: l.variantId,
      productTitle: l.variant.product.title,
      variantTitle: l.variant.title,
      sku: l.variant.sku,
      quantity: l.quantity,
      unitCost: l.unitCost,
      subtotal: (l.unitCost ?? 0) * l.quantity,
      orderedQuantity: calc.orderedQuantity,
      receivedQuantity: calc.receivedQuantity,
      remainingQuantity: calc.remainingQuantity,
      receivingStatus: calc.receivingStatus,
      expectedCost: mappings.find((m) => m.variantId === l.variantId)?.supplierCost ?? null,
    };
  });

  const summary = getPoReceivingSummary(po.lines, po.status);
  const totalOrderedQuantity = summary.totalOrderedQuantity;
  const totalReceivedQuantity = summary.totalReceivedQuantity;
  const totalRemainingQuantity = summary.totalRemainingQuantity;
  const receiveProgressPercent = summary.receiveProgressPercent;
  const canReceive = summary.canReceive;

  // Format receipts history
  const receiptHistory = po.receipts.map((r) => ({
    id: r.id,
    receivedAt: r.receivedAt.toISOString(),
    notes: r.notes,
    totalQuantity: r.lines.reduce((sum, rl) => sum + rl.quantityReceived, 0),
    lines: r.lines.map((rl) => ({
      id: rl.id,
      sku: rl.purchaseOrderLine.variant.sku || "-",
      productTitle: rl.purchaseOrderLine.variant.product.title,
      variantTitle: rl.purchaseOrderLine.variant.title,
      quantityReceived: rl.quantityReceived,
    })),
  }));

  const companyAddressParts = [
    settings?.addressLine1,
    settings?.addressLine2,
    [settings?.city, settings?.region, settings?.postalCode].filter(Boolean).join(", "),
    settings?.country,
  ].filter(Boolean);

  return {
    currencyCode,
    companyName,
    companyEmail: settings?.contactEmail || null,
    companyPhone: settings?.phone || null,
    companyAddress: companyAddressParts,
    defaultPaymentTerms: settings?.defaultPaymentTerms || null,
    defaultSubject,
    defaultMessage,
    supplierEmail,
    automationMode: settings?.supplierEmailAutomationMode ?? "REVIEW_BEFORE_SEND",
    po: {
      id: po.id,
      reference: po.reference,
      supplierId: po.supplierId,
      supplierName: po.supplier.name,
      supplierEmail: po.supplier.email,
      supplierEmailSnapshot: po.supplierEmailSnapshot,
      supplierPhone: po.supplier.phone || null,
      supplierPaymentTerms: po.supplier.paymentTerms || null,
      status: po.status,
      expectedArrival: po.expectedArrival?.toISOString().slice(0, 10) ?? "",
      notes: po.notes,
      lastSentAt: po.lastSentAt?.toISOString() ?? null,
      sentCount: po.sentCount,
      isRecurring: po.isRecurring,
      recurringIntervalDays: po.recurringIntervalDays,
      nextRecurringDate: po.nextRecurringDate?.toISOString().slice(0, 10) ?? "",
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
      lines: processedLines,
      totalCost: processedLines.reduce((sum, l) => sum + l.subtotal, 0),
      totalOrderedQuantity,
      totalReceivedQuantity,
      totalRemainingQuantity,
      receiveProgressPercent,
      canReceive,
    },
    receiptHistory,
    variants: variants.map((v) => ({
      id: v.id,
      productTitle: v.product.title,
      variantTitle: v.title,
      sku: v.sku,
      unitCostAmount: v.unitCostAmount,
    })),
    mappings: mappings.map((m) => ({
      supplierId: po.supplierId,
      variantId: m.variantId,
      supplierCost: m.supplierCost,
    })),
    duplicateLines: duplicateLines.map((line) => ({
      id: line.id,
      variantTitle: line.variant.title,
      purchaseOrderReference: line.purchaseOrder.reference,
      purchaseOrderStatus: line.purchaseOrder.status,
      supplierName: line.purchaseOrder.supplier.name,
    })),
    isDraft: po.status === "DRAFT",
    canMarkSent: ["DRAFT", "SENT", "CONFIRMED"].includes(po.status),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "purchase-order-detail-action");
  const store = await prisma.store.findUnique({ 
    where: { shop: session.shop },
    include: { settings: true }
  });
  if (!store) return { ok: false, message: "Store not found." } satisfies ActionData;

  const po = await prisma.purchaseOrder.findFirst({
    where: { id: params.id, storeId: store.id },
    include: { supplier: true },
  });
  if (!po) return { ok: false, message: "Purchase order not found." } satisfies ActionData;

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "record-receipt") {
    if (!["SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "DELAYED"].includes(po.status)) {
      if (po.status === "DRAFT") {
        return { ok: false, message: "Send or confirm this PO before receiving items." } satisfies ActionData;
      }
      if (po.status === "RECEIVED") {
        return { ok: false, message: "This PO is fully received." } satisfies ActionData;
      }
      if (po.status === "CANCELLED") {
        return { ok: false, message: "Cancelled purchase orders cannot be received." } satisfies ActionData;
      }
      return { ok: false, message: `Receiving is not available for ${po.status.replaceAll("_", " ")} purchase orders.` } satisfies ActionData;
    }

    const receivedAtInput = String(formData.get("receivedAt") || "").trim();
    const notes = optionalString(formData.get("notes"));
    let receivedAt = new Date();
    if (receivedAtInput) {
      const parsedDate = new Date(`${receivedAtInput}T00:00:00.000Z`);
      if (Number.isNaN(parsedDate.getTime())) {
        return { ok: false, message: "Received date must be a valid date." } satisfies ActionData;
      }
      receivedAt = parsedDate;
    }

    const poWithLines = await prisma.purchaseOrder.findFirst({
      where: { id: po.id, storeId: store.id },
      include: {
        lines: {
          include: {
            variant: { include: { product: true } },
            receiptLines: true,
          },
        },
      },
    });

    if (!poWithLines) return { ok: false, message: "Purchase order not found." } satisfies ActionData;

    const receiptLinesToCreate: Array<{ purchaseOrderLineId: string; quantityReceived: number }> = [];
    let newReceiptTotalQty = 0;

    for (const line of poWithLines.lines) {
      const inputStr = String(formData.get(`qty_${line.id}`) || "").trim();
      if (!inputStr) continue;

      if (!/^\d+$/.test(inputStr)) {
        return { ok: false, message: "Invalid quantity specified for line item." } satisfies ActionData;
      }

      const qty = parseInt(inputStr, 10);
      if (qty === 0) continue;

      const existingReceived = line.receiptLines.reduce((sum, rl) => sum + rl.quantityReceived, 0);
      const remaining = Math.max(0, line.quantity - existingReceived);

      if (qty > remaining) {
        return {
          ok: false,
          message: `Cannot receive ${qty} units of "${line.variant.product.title} - ${line.variant.title}". Remaining quantity is only ${remaining}.`,
        } satisfies ActionData;
      }

      receiptLinesToCreate.push({
        purchaseOrderLineId: line.id,
        quantityReceived: qty,
      });
      newReceiptTotalQty += qty;
    }

    if (receiptLinesToCreate.length === 0 || newReceiptTotalQty <= 0) {
      return { ok: false, message: "At least one line item must have a receive quantity greater than zero." } satisfies ActionData;
    }

    const isFullyReceived = await prisma.$transaction(async (tx) => {
      await tx.purchaseOrderReceipt.create({
        data: {
          storeId: store.id,
          purchaseOrderId: po.id,
          receivedAt,
          notes,
          lines: {
            create: receiptLinesToCreate,
          },
        },
      });

      let totalOrdered = 0;
      let totalReceived = 0;

      for (const line of poWithLines.lines) {
        totalOrdered += line.quantity;
        const previousReceived = line.receiptLines.reduce((sum, rl) => sum + rl.quantityReceived, 0);
        const newlyReceived = receiptLinesToCreate.find((r) => r.purchaseOrderLineId === line.id)?.quantityReceived ?? 0;
        totalReceived += previousReceived + newlyReceived;
      }

      const fullyReceived = totalReceived >= totalOrdered;
      const nextStatus = fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";

      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: nextStatus as PurchaseOrderStatus,
          updatedAt: new Date(),
        },
      });

      return fullyReceived;
    });

    return {
      ok: true,
      message: isFullyReceived
        ? "Receipt recorded. PO fully received."
        : "Receipt recorded. PO moved to PARTIALLY RECEIVED.",
    } satisfies ActionData;
  }

  if (intent === "mark-sent") {
    if (!["DRAFT", "SENT", "CONFIRMED"].includes(po.status)) {
      return {
        ok: false,
        message: `Mark as sent is not available for ${po.status.replaceAll("_", " ")} purchase orders.`,
      } satisfies ActionData;
    }

    const emailInput = String(formData.get("supplierEmail") || "").trim();
    if (emailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      return {
        ok: false,
        message: "Please enter a valid supplier email address.",
      } satisfies ActionData;
    }

    const nextStatus = po.status === "DRAFT" ? "SENT" : po.status;

    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: nextStatus as PurchaseOrderStatus,
        lastSentAt: new Date(),
        sentCount: { increment: 1 },
        supplierEmailSnapshot: emailInput || po.supplierEmailSnapshot || po.supplier.email || null,
      },
    });

    return {
      ok: true,
      message: `Purchase order marked as sent${nextStatus === "SENT" && po.status === "DRAFT" ? " (status moved to SENT)" : ""}.`,
    } satisfies ActionData;
  }

  if (intent === "auto-send") {
    if (!["DRAFT", "SENT", "CONFIRMED"].includes(po.status)) {
      return { ok: false, message: `Auto-send is not available for ${po.status.replaceAll("_", " ")} purchase orders.` } satisfies ActionData;
    }

    const emailInput = String(formData.get("supplierEmail") || "").trim();
    if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      return { ok: false, message: "Please enter a valid supplier email address to auto-send." } satisfies ActionData;
    }

    const poWithLines = await prisma.purchaseOrder.findFirst({
      where: { id: po.id, storeId: store.id },
      include: { supplier: true, lines: { include: { variant: { include: { product: true } } } } },
    });
    if (!poWithLines) return { ok: false, message: "Purchase order not found." } satisfies ActionData;

    const provider = store.settings?.emailProvider || "SMTP";
    if (provider === "RESEND") {
      if (!store.settings?.resendApiKey || !store.settings?.resendFromEmail) {
        return { ok: false, message: "Resend is not configured. Please add your Resend API Key and Verified Sender Email in Settings." } satisfies ActionData;
      }
    } else {
      if (!store.settings?.smtpHost || !store.settings?.smtpPort || !store.settings?.smtpUser || !store.settings?.smtpPassword) {
        return { ok: false, message: "SMTP is not configured. Please add your SMTP credentials in Settings." } satisfies ActionData;
      }
    }

    try {
      const { generatePurchaseOrderEmailHtml, sendPurchaseOrderEmail } = await import("../email.server");
      const currencyCode = store.settings.currencyCode || "USD";
      
      const htmlContent = generatePurchaseOrderEmailHtml({
        reference: poWithLines.reference,
        expectedArrival: poWithLines.expectedArrival?.toISOString().slice(0, 10) || "",
        notes: poWithLines.notes,
        totalCost: poWithLines.lines.reduce((sum, l) => sum + ((l.unitCost ?? 0) * l.quantity), 0),
        currencyCode,
        supplierName: poWithLines.supplier.name,
        storeName: store.settings?.companyName || store.name || store.shop,
        lines: poWithLines.lines.map((l) => ({
          sku: l.variant.sku || "",
          productTitle: l.variant.product.title,
          variantTitle: l.variant.title,
          quantity: l.quantity,
          unitCost: l.unitCost,
          subtotal: (l.unitCost ?? 0) * l.quantity,
        })),
      });

      const subject = String(formData.get("subject") || `Purchase Order ${poWithLines.reference} from ${store.name || store.shop}`);

      await sendPurchaseOrderEmail({
        recipientEmail: emailInput,
        subject,
        htmlContent,
        provider,
        apiKey: store.settings.resendApiKey,
        fromEmail: store.settings.resendFromEmail,
        smtpHost: store.settings.smtpHost,
        smtpPort: store.settings.smtpPort,
        smtpUser: store.settings.smtpUser,
        smtpPassword: store.settings.smtpPassword,
      });

      const nextStatus = po.status === "DRAFT" ? "SENT" : po.status;
      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: nextStatus as PurchaseOrderStatus,
          lastSentAt: new Date(),
          sentCount: { increment: 1 },
          supplierEmailSnapshot: emailInput,
        },
      });

      return {
        ok: true,
        message: `Email sent to ${emailInput} via Resend. PO marked as sent.`,
      } satisfies ActionData;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { ok: false, message: `Failed to send email: ${msg}` } satisfies ActionData;
    }
  }

  if (intent === "update-status") {
    const nextStatus = String(formData.get("status") || "");
    const allowedNext = ALLOWED_STATUS_TRANSITIONS[po.status] || [];
    if (!allowedNext.includes(nextStatus)) {
      return { ok: false, message: "Invalid status transition." } satisfies ActionData;
    }
    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: nextStatus as PurchaseOrderStatus },
    });
    return { ok: true, message: `Status updated to ${nextStatus.replaceAll("_", " ")}.` } satisfies ActionData;
  }

  if (intent === "update-reference" || intent === "update-po") {
    if (po.status !== "DRAFT") {
      return { ok: false, message: "Only draft purchase orders can be edited." } satisfies ActionData;
    }

    const newReference = String(formData.get("reference") || "").trim();
    if (!newReference) {
      return { ok: false, message: "PO reference is required." } satisfies ActionData;
    }

    if (newReference !== po.reference) {
      const existing = await prisma.purchaseOrder.findFirst({
        where: {
          storeId: store.id,
          reference: newReference,
          NOT: { id: po.id },
        },
      });
      if (existing) {
        return {
          ok: false,
          message: "Another purchase order already uses this reference.",
        } satisfies ActionData;
      }
    }

    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        reference: newReference,
        expectedArrival: dateFromForm(formData.get("expectedArrival")),
        notes: optionalString(formData.get("notes")),
      },
    });
    return { ok: true, message: intent === "update-reference" ? "PO reference updated." : "Purchase order updated." } satisfies ActionData;
  }

  if (intent === "add-line") {
    if (po.status !== "DRAFT") {
      return { ok: false, message: "Lines can only be added to draft purchase orders." } satisfies ActionData;
    }
    const variantId = String(formData.get("variantId") || "").trim();
    const quantityText = String(formData.get("quantity") || "").trim();
    const costStr = String(formData.get("unitCost") || "").trim();
    const parsedUnitCost = costStr ? Number(costStr) : null;

    if (!variantId) {
      return { ok: false, message: "Variant is required." } satisfies ActionData;
    }
    if (!/^\d+$/.test(quantityText) || Number(quantityText) <= 0) {
      return { ok: false, message: "Quantity must be a positive whole number." } satisfies ActionData;
    }
    if (costStr && (parsedUnitCost === null || !Number.isFinite(parsedUnitCost) || parsedUnitCost < 0)) {
      return { ok: false, message: "Unit cost must be a valid non-negative number." } satisfies ActionData;
    }
    const quantity = Number(quantityText);

    const variant = await prisma.shopifyVariant.findFirst({
      where: { id: variantId, storeId: store.id },
    });
    if (!variant) {
      return { ok: false, message: "Variant not found for this store." } satisfies ActionData;
    }

    await prisma.purchaseOrderLine.create({
      data: {
        purchaseOrderId: po.id,
        variantId: variant.id,
        quantity,
        unitCost: parsedUnitCost,
      },
    });
    return { ok: true, message: "Line item added." } satisfies ActionData;
  }

  if (intent === "remove-line") {
    if (po.status !== "DRAFT") {
      return { ok: false, message: "Lines can only be removed from draft purchase orders." } satisfies ActionData;
    }
    const lineId = String(formData.get("lineId") || "");
    const line = await prisma.purchaseOrderLine.findFirst({
      where: { id: lineId, purchaseOrderId: po.id },
    });
    if (!line) {
      return { ok: false, message: "Line item not found." } satisfies ActionData;
    }
    await prisma.purchaseOrderLine.delete({ where: { id: line.id } });
    return { ok: true, message: "Line item removed." } satisfies ActionData;
  }

  if (intent === "duplicate") {
    const original = await prisma.purchaseOrder.findFirst({
      where: { id: po.id, storeId: store.id },
      include: { lines: true },
    });
    if (!original) return { ok: false, message: "PO not found." } satisfies ActionData;

    const reference = await createUniquePoReference(store.id);
    const newPo = await prisma.purchaseOrder.create({
      data: {
        storeId: store.id,
        supplierId: original.supplierId,
        reference,
        notes: original.notes,
        lines: {
          create: original.lines.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        },
      },
    });
    return redirect(`/app/purchase-orders/${newPo.id}`);
  }

  if (intent === "set-recurring") {
    const isRecurring = formData.get("isRecurring") === "true";
    const recurringIntervalDaysInput = formData.get("recurringIntervalDays");
    const recurringIntervalDays = recurringIntervalDaysInput ? Number.parseInt(String(recurringIntervalDaysInput), 10) : null;
    const nextRecurringDateInput = formData.get("nextRecurringDate");
    const nextRecurringDate = nextRecurringDateInput ? new Date(`${String(nextRecurringDateInput)}T00:00:00.000Z`) : null;

    if (isRecurring && (!recurringIntervalDays || !nextRecurringDate)) {
      return { ok: false, message: "Recurring interval and next date are required when enabling recurring orders." } satisfies ActionData;
    }

    await prisma.purchaseOrder.update({
      where: { id: po.id },
      data: {
        isRecurring,
        recurringIntervalDays: isRecurring ? recurringIntervalDays : null,
        nextRecurringDate: isRecurring ? nextRecurringDate : null,
      },
    });

    return { ok: true, message: isRecurring ? "Purchase order set to recurring." : "Recurring order disabled." } satisfies ActionData;
  }

  if (intent === "delete") {
    if (po.status !== "DRAFT") {
      return { ok: false, message: "Only draft purchase orders can be deleted." } satisfies ActionData;
    }
    await prisma.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: po.id } });
    await prisma.purchaseOrder.delete({ where: { id: po.id } });
    return redirect("/app/purchase-orders");
  }

  return { ok: false, message: "Unknown action." } satisfies ActionData;
};

export default function PurchaseOrderDetailPage() {
  const {
    currencyCode,
    companyName,
    companyEmail,
    companyPhone,
    companyAddress,
    defaultPaymentTerms,
    defaultSubject,
    defaultMessage,
    supplierEmail,
    po,
    receiptHistory,
    variants,
    mappings,
    duplicateLines,
    isDraft,
    canMarkSent,
    automationMode,
  } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [unitCost, setUnitCost] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const variantOptions = variants.map(v => ({ value: v.id, label: v.productTitle + " - " + v.variantTitle + (v.sku ? " (" + v.sku + ")" : "") }));

  const [recipientEmail, setRecipientEmail] = useState(po.supplierEmailSnapshot || supplierEmail || "");
  const [emailSubject, setEmailSubject] = useState(defaultSubject);
  const [emailMessage, setEmailMessage] = useState(defaultMessage);
  const [copyNotice, setCopyNotice] = useState("");

  async function handleCopy(text: string, label: string) {
    if (!text) {
      setCopyNotice(`No ${label.toLowerCase()} available to copy.`);
      setTimeout(() => setCopyNotice(""), 3000);
      return;
    }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyNotice(`${label} copied to clipboard!`);
      } else {
        setCopyNotice(`Clipboard API unavailable. Please select text manually.`);
      }
    } catch {
      setCopyNotice(`Could not copy ${label.toLowerCase()}. Please select text manually.`);
    }
    setTimeout(() => setCopyNotice(""), 3000);
  }

  function handleVariantChange(variantId: string) {
    if (!variantId) return;
    const mapping = mappings.find((m) => m.supplierId === po.supplierId && m.variantId === variantId);
    const variant = variants.find((v) => v.id === variantId);
    const cost = mapping?.supplierCost ?? variant?.unitCostAmount ?? null;
    if (cost != null) {
      setUnitCost(String(cost));
    }
  }

  const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[po.status] || [];
  const isTerminalState = allowedTransitions.length === 0;

  const mailtoBody = `${emailMessage}\n\nNote: Open PODesk and print PO ${po.reference} from the purchase order page.`;
  const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(mailtoBody)}`;

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <>
      <ui-title-bar title={po.reference}></ui-title-bar>
      <div className="po-detail-container" style={pageContainerStyle}>
      {actionData?.message ? (
        <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
      ) : null}

      {isDraft && duplicateLines && duplicateLines.length > 0 && (
        <div style={{ ...noticeStyle(false), backgroundColor: "#fff5ea", color: "#8a6116", border: "1px solid #ffd399", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          <strong>Duplicate Alert</strong>
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            {duplicateLines.map((dl) => (
              <li key={dl.id}>
                {dl.variantTitle} is already in {dl.purchaseOrderStatus.toLowerCase()} PO <strong>{dl.purchaseOrderReference}</strong> ({dl.supplierName})
              </li>
            ))}
          </ul>
        </div>
      )}

      
      <div style={mainGridStyle}>
        <div style={colStyle}>
          <div style={cardStyle}>
  <h2 style={cardHeaderStyle}>{`Line items (${po.lines.length})`}</h2>
  <div style={cardContentStyle}>
    <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Product</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Ordered</th>
                <th style={thStyle}>Received</th>
                <th style={thStyle}>Remaining</th>
                <th style={thStyle}>Unit cost</th>
                <th style={thStyle}>Subtotal</th>
                {isDraft && <th style={thStyle}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line) => (
                <tr key={line.id}>
                  <td style={tdStyle}>
                    {line.productTitle}
                    <div style={mutedStyle}>{line.variantTitle}</div>
                  </td>
                  <td style={tdStyle}>{line.sku || "-"}</td>
                  <td style={tdStyle}>{line.orderedQuantity}</td>
                  <td style={tdStyle}>{line.receivedQuantity}</td>
                  <td style={tdStyle}>{line.remainingQuantity}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {line.unitCost != null ? formatCurrency(line.unitCost, currencyCode) : "-"}
                      {line.expectedCost != null && line.unitCost != null && line.unitCost > line.expectedCost && (
                        <span style={{ color: "#d82c0d", fontSize: "12px", display: "flex", alignItems: "center" }} title={`Expected cost is ${formatCurrency(line.expectedCost, currencyCode)}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={tdStyle}>{line.subtotal > 0 ? formatCurrency(line.subtotal, currencyCode) : "-"}</td>
                  {isDraft && (
                    <td style={tdStyle}>
                      <Form method="post" style={{ display: "inline" }}>
                        <input type="hidden" name="intent" value="remove-line" />
                        <input type="hidden" name="lineId" value={line.id} />
                        <button type="submit" style={smallBtnStyle}>Remove</button>
                      </Form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isDraft && (
          <div style={{ marginTop: "12px", padding: "12px", border: "1px solid #dfe3e8", borderRadius: "8px" }}>
            <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>Add line item</div>
            <Form method="post">
              <input type="hidden" name="intent" value="add-line" />
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "8px" }}>
                <div style={{ minWidth: "300px", zIndex: 50 }}>
                  <SearchableSelect
                    name="variantId"
                    required
                    placeholder="Search variant or SKU..."
                    value={selectedVariantId}
                    onChange={(val) => {
                      setSelectedVariantId(val);
                      handleVariantChange(val);
                    }}
                    options={variants.map((v) => {
                      const isMapped = mappings.some((m) => m.supplierId === po.supplierId && m.variantId === v.id);
                      return {
                        value: v.id,
                        label: `${v.productTitle} - ${v.variantTitle} ${v.sku ? `(${v.sku})` : ""}${isMapped ? " [mapped]" : ""}`
                      };
                    })}
                  />
                </div>
                <input name="quantity" type="number" placeholder="Qty" min="1" required style={inputStyle} />
                <input
                  name="unitCost"
                  type="number"
                  step="0.01"
                  placeholder="Cost"
                  style={inputStyle}
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                />
              </div>
              <button type="submit" disabled={isSubmitting} style={{ ...buttonStyle, marginTop: "8px" }}>
                Add line
              </button>
            </Form>
          </div>
        )}
  </div>
</div>
          <div style={cardStyle}>
  <h2 style={cardHeaderStyle}>Receiving</h2>
  <div style={cardContentStyle}>
    <div style={receivingGridStyle}>
          <div style={cardMetricStyle}>
            <div style={metricLabelStyle}>Total ordered</div>
            <div style={metricValueStyle}>{po.totalOrderedQuantity}</div>
          </div>
          <div style={cardMetricStyle}>
            <div style={metricLabelStyle}>Total received</div>
            <div style={metricValueStyle}>{po.totalReceivedQuantity}</div>
          </div>
          <div style={cardMetricStyle}>
            <div style={metricLabelStyle}>Remaining</div>
            <div style={metricValueStyle}>{po.totalRemainingQuantity}</div>
          </div>
          <div style={cardMetricStyle}>
            <div style={metricLabelStyle}>Progress</div>
            <div style={metricValueStyle}>{po.receiveProgressPercent}%</div>
            <div style={progressTrackStyle}>
              <div style={{ ...progressBarFillStyle, width: `${po.receiveProgressPercent}%` }} />
            </div>
          </div>
        </div>

        {!po.canReceive ? (
          <div style={mutedBannerStyle}>
            {po.status === "DRAFT" && "Send or confirm this PO before receiving items."}
            {po.status === "RECEIVED" && "This PO is fully received."}
            {po.status === "CANCELLED" && "Cancelled purchase orders cannot be received."}
          </div>
        ) : (
          <Form method="post" style={{ marginTop: "16px" }}>
            <input type="hidden" name="intent" value="record-receipt" />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", marginBottom: "16px" }}>
              <DatePickerField label="Date received" name="receivedAt" defaultValue={todayIso} required />
              <label style={fieldLabelStyle}>
                Notes
                <input
                  name="notes"
                  type="text"
                  placeholder="Optional receiving notes (e.g. Packing slip #1234)"
                  style={inputStyle}
                />
              </label>
            </div>

            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Product</th>
                    <th style={thStyle}>SKU</th>
                    <th style={thStyle}>Ordered</th>
                    <th style={thStyle}>Received</th>
                    <th style={thStyle}>Remaining</th>
                    <th style={thStyle}>Receive now</th>
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((line) => (
                    <tr key={line.id}>
                      <td style={tdStyle}>
                        {line.productTitle}
                        <div style={mutedStyle}>{line.variantTitle}</div>
                      </td>
                      <td style={tdStyle}>{line.sku || "-"}</td>
                      <td style={tdStyle}>{line.orderedQuantity}</td>
                      <td style={tdStyle}>{line.receivedQuantity}</td>
                      <td style={tdStyle}>
                        <strong>{line.remainingQuantity}</strong>
                      </td>
                      <td style={tdStyle}>
                        {line.remainingQuantity > 0 ? (
                          <input
                            name={`qty_${line.id}`}
                            type="number"
                            min="0"
                            max={line.remainingQuantity}
                            placeholder="0"
                            style={{ ...inputStyle, width: "100px" }}
                          />
                        ) : (
                          <span style={completeBadgeStyle}>Done</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "14px" }}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={buttonStyle}
              >
                {isSubmitting ? "Recording receipt..." : "Record receipt"}
              </button>
            </div>
          </Form>
        )}
  </div>
</div>
          <div style={cardStyle}>
  <h2 style={cardHeaderStyle}>Receipt history</h2>
  <div style={cardContentStyle}>
    {receiptHistory.length === 0 ? (
          <div style={mutedStyle}>No receipts recorded yet.</div>
        ) : (
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Lines received</th>
                  <th style={thStyle}>Total quantity</th>
                  <th style={thStyle}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {receiptHistory.map((receipt) => (
                  <tr key={receipt.id}>
                    <td style={tdStyle}>{formatDate(receipt.receivedAt)}</td>
                    <td style={tdStyle}>
                      {receipt.lines.map((rl) => (
                        <div key={rl.id}>
                          {rl.productTitle} - {rl.variantTitle} {rl.sku !== "-" ? `(${rl.sku})` : ""}: <strong>+{rl.quantityReceived}</strong>
                        </div>
                      ))}
                    </td>
                    <td style={tdStyle}>
                      <strong>+{receipt.totalQuantity}</strong>
                    </td>
                    <td style={tdStyle}>{receipt.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
  </div>
</div>
        </div>
        <div style={colStyle}>
          <div style={cardStyle}>
  <h2 style={cardHeaderStyle}>Details</h2>
  <div style={cardContentStyle}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div style={metaGridStyle}>
            <div><strong>Supplier:</strong> <Link to={`/app/suppliers/${po.supplierId}`} style={linkStyle}>{po.supplierName}</Link></div>
            <div><strong>Status:</strong> <span style={statusBadge(po.status)}>{po.status.replaceAll("_", " ")}</span></div>
            <div><strong>Total cost:</strong> {po.totalCost > 0 ? formatCurrency(po.totalCost, currencyCode) : "-"}</div>
            <div><strong>Currency:</strong> {currencyCode}</div>
            <div><strong>Receiving:</strong> {po.totalReceivedQuantity} / {po.totalOrderedQuantity} received ({po.receiveProgressPercent}%)</div>
            <div><strong>Last sent:</strong> {po.lastSentAt ? formatDate(po.lastSentAt) : "Not sent yet"}</div>
            <div><strong>Sent count:</strong> {po.sentCount} time(s)</div>
            <div><strong>Created:</strong> {formatDate(po.createdAt)}</div>
            <div><strong>Last updated:</strong> {formatDate(po.updatedAt)}</div>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            style={printBtnLinkStyle}
          >
            🖨 Print PO
          </button>
        </div>
  </div>
</div>
          <div style={cardStyle}>
  <h2 style={cardHeaderStyle}>Status</h2>
  <div style={cardContentStyle}>
    {isTerminalState ? (
          <div style={mutedStyle}>No further status changes available for {po.status.replaceAll("_", " ")} purchase orders.</div>
        ) : (
          <Form method="post" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <input type="hidden" name="intent" value="update-status" />
            {allowedTransitions.map((s) => (
              <button
                key={s}
                type="submit"
                name="status"
                value={s}
                disabled={isSubmitting}
                style={statusBtn}
              >
                Move to {s.replaceAll("_", " ")}
              </button>
            ))}
          </Form>
        )}
  </div>
</div>
          <div style={cardStyle}>
  <h2 style={cardHeaderStyle}>Supplier sharing</h2>
  <div style={cardContentStyle}>
    {copyNotice ? (
          <div style={noticeStyle(true)}>{copyNotice}</div>
        ) : null}

        <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <label style={fieldLabelStyle}>
              Supplier email address
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="e.g. supplier@example.com"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => handleCopy(recipientEmail, "Supplier email")}
                  style={smallBtnStyle}
                >
                  Copy email
                </button>
              </div>
            </label>
            {!recipientEmail && (
              <div style={mutedStyle}>No email saved for this supplier. Enter email above to share.</div>
            )}
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={fieldLabelStyle}>
              Email subject
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => handleCopy(emailSubject, "Subject")}
                  style={smallBtnStyle}
                >
                  Copy subject
                </button>
              </div>
            </label>
          </div>

          <div style={{ display: "grid", gap: "6px" }}>
            <label style={fieldLabelStyle}>
              Message template
              <textarea
                rows={5}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                style={textareaStyle}
              />
            </label>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => handleCopy(emailMessage, "Message")}
                style={smallBtnStyle}
              >
                Copy message
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", paddingTop: "12px", borderTop: "1px solid #dfe3e8" }}>
          {automationMode === "AUTO_SEND_AFTER_REVIEW" ? (
            <Form method="post" style={{ display: "inline-flex" }}>
              <input type="hidden" name="intent" value="auto-send" />
              <input type="hidden" name="supplierEmail" value={recipientEmail} />
              <input type="hidden" name="subject" value={emailSubject} />
              <button type="submit" disabled={isSubmitting} style={buttonStyle}>
                Send PO via Email (Auto)
              </button>
            </Form>
          ) : (
            <a
              href={mailtoUrl}
              style={secondaryBtnLinkStyle}
            >
              Open email draft
            </a>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            style={secondaryBtnLinkStyle}
          >
            🖨 Print / Save PDF
          </button>
          {canMarkSent && (
            <Form method="post" style={{ display: "inline" }}>
              <input type="hidden" name="intent" value="mark-sent" />
              <input type="hidden" name="supplierEmail" value={recipientEmail} />
              <button
                type="submit"
                disabled={isSubmitting}
                style={buttonStyle}
              >
                {isSubmitting ? "Updating..." : "Mark as sent"}
              </button>
            </Form>
          )}

          {po.lastSentAt && (
            <div style={mutedStyle}>
              Last sent: {formatDate(po.lastSentAt)} ({po.sentCount}x)
            </div>
          )}
        </div>
  </div>
</div>
          <div style={cardStyle}>
            <h2 style={cardHeaderStyle}>Edit</h2>
            <div style={cardContentStyle}>
              <Form method="post" style={{ display: "grid", gap: "16px" }}>
                <input type="hidden" name="intent" value="update-po" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <Field label="PO reference" name="reference" type="text" required defaultValue={po.reference} />
                  <DatePickerField label="Expected arrival" name="expectedArrival" defaultValue={po.expectedArrival} />
                </div>
                <label style={fieldLabelStyle}>
                  Notes
                  <textarea name="notes" rows={3} style={textareaStyle} defaultValue={po.notes ?? ""} />
                </label>
                <div>
                  <button type="submit" disabled={isSubmitting} style={buttonStyle}>
                    Save changes
                  </button>
                </div>
              </Form>
            </div>
          </div>
          <div style={cardStyle}>
            <h2 style={cardHeaderStyle}>Recurring Settings</h2>
            <div style={cardContentStyle}>
              <Form method="post" style={{ display: "grid", gap: "16px" }}>
                <input type="hidden" name="intent" value="set-recurring" />
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 500 }}>
                    <input 
                      type="checkbox" 
                      name="isRecurring" 
                      value="true"
                      defaultChecked={po.isRecurring} 
                    />
                    Make this PO recurring
                  </label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <Field label="Interval (Days)" name="recurringIntervalDays" type="number" defaultValue={po.recurringIntervalDays?.toString() ?? ""} placeholder="e.g. 30" />
                  <DatePickerField label="Next Generation Date" name="nextRecurringDate" defaultValue={po.nextRecurringDate ?? ""} />
                </div>
                <div>
                  <button type="submit" disabled={isSubmitting} style={buttonStyle}>
                    Save recurring settings
                  </button>
                </div>
              </Form>
            </div>
          </div>
          <div style={cardStyle}>
            <h2 style={cardHeaderStyle}>Actions</h2>
            <div style={cardContentStyle}>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" onClick={() => window.print()} style={buttonSecondaryStyle}>🖨 Print PO</button>
                <Form method="post" style={{ display: "inline-flex" }}>
                  <input type="hidden" name="intent" value="duplicate" />
                  <button type="submit" disabled={isSubmitting} style={buttonSecondaryStyle}>Duplicate PO</button>
                </Form>
                {isDraft && (
                  <Form method="post" style={{ display: "inline-flex" }}>
                    <input type="hidden" name="intent" value="delete" />
                    <button type="submit" disabled={isSubmitting} style={dangerBtnStyle}>Delete PO</button>
                  </Form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ─── Inline Print Layout (hidden on screen, visible during @media print) ─── */}
      <style>{`
        @media print {
          /* Hide everything except the print layout */
          body > * { display: none !important; }
          .shopify-app-bridge-initialized .Polaris-Frame { display: none !important; }
          #po-print-layout { display: block !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { margin: 18mm 14mm; size: A4; }
        }
        #po-print-layout { display: none; }
      `}</style>

      <div id="po-print-layout" style={{
        fontFamily: "'Helvetica Neue', Arial, sans-serif",
        fontSize: "12px",
        color: "#111",
        lineHeight: 1.4,
        background: "#fff",
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 99999,
        padding: "0",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ background: "#111", color: "#fff", padding: "24px 32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#aaa", marginBottom: "4px" }}>Purchase Order</div>
            <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px" }}>{po.reference}</div>
            <div style={{ marginTop: "6px", fontSize: "11px", color: "#ccc" }}>Status: {po.status.replace(/_/g, " ")}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "15px", fontWeight: 700 }}>{companyName}</div>
            {companyAddress.map((line, i) => <div key={i} style={{ fontSize: "11px", color: "#ccc" }}>{line}</div>)}
            {companyEmail && <div style={{ fontSize: "11px", color: "#ccc" }}>{companyEmail}</div>}
            {companyPhone && <div style={{ fontSize: "11px", color: "#ccc" }}>{companyPhone}</div>}
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", borderBottom: "2px solid #e5e7eb" }}>
          <div style={{ padding: "20px 32px", borderRight: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#888", marginBottom: "8px" }}>Supplier</div>
            <div style={{ fontWeight: 700, fontSize: "13px" }}>{po.supplierName}</div>
            {(po.supplierEmailSnapshot || po.supplierEmail) && <div style={{ color: "#555", fontSize: "11px" }}>{po.supplierEmailSnapshot || po.supplierEmail}</div>}
            {po.supplierPhone && <div style={{ color: "#555", fontSize: "11px" }}>{po.supplierPhone}</div>}
            {(po.supplierPaymentTerms || defaultPaymentTerms) && <div style={{ color: "#555", fontSize: "11px", marginTop: "4px" }}>Terms: {po.supplierPaymentTerms || defaultPaymentTerms}</div>}
          </div>
          <div style={{ padding: "20px 32px" }}>
            <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#888", marginBottom: "8px" }}>Order Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 16px", fontSize: "12px" }}>
              <span style={{ color: "#888" }}>Date:</span><span>{formatDate(po.createdAt)}</span>
              <span style={{ color: "#888" }}>Expected:</span><span>{po.expectedArrival ? formatDate(po.expectedArrival + "T00:00:00Z") : "—"}</span>
              <span style={{ color: "#888" }}>Currency:</span><span>{currencyCode}</span>
            </div>
          </div>
        </div>

        {/* Line items table */}
        <div style={{ padding: "0 32px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                {["Product", "Variant", "SKU", "Qty Ordered", "Qty Received", "Remaining", "Unit Cost", "Subtotal"].map(h => (
                  <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#888", fontWeight: 600, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {po.lines.map((line, i) => (
                <tr key={line.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6", fontSize: "12px" }}>{line.productTitle}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6", fontSize: "11px", color: "#555" }}>{line.variantTitle}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6", fontSize: "11px", color: "#777", fontFamily: "monospace" }}>{line.sku || "—"}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{line.quantity}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "right", color: "#16a34a" }}>{line.receivedQuantity}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "right", color: line.remainingQuantity > 0 ? "#d97706" : "#16a34a" }}>{line.remainingQuantity}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{line.unitCost != null ? formatCurrency(line.unitCost, currencyCode) : "—"}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "right", fontWeight: 600 }}>{formatCurrency(line.subtotal, currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 32px 0" }}>
          <div style={{ minWidth: "260px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #e5e7eb", fontSize: "12px" }}>
              <span>Total Qty Ordered</span><span style={{ fontWeight: 600 }}>{po.totalOrderedQuantity}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid #e5e7eb", fontSize: "12px" }}>
              <span>Total Qty Received</span><span style={{ fontWeight: 600, color: "#16a34a" }}>{po.totalReceivedQuantity}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "2px solid #111", fontSize: "14px", fontWeight: 700 }}>
              <span>Total Cost</span><span>{formatCurrency(po.totalCost, currencyCode)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {po.notes && (
          <div style={{ margin: "16px 32px", padding: "14px", background: "#f9fafb", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
            <div style={{ fontSize: "9px", textTransform: "uppercase", color: "#888", marginBottom: "4px" }}>Notes</div>
            <div style={{ fontSize: "12px", color: "#444", whiteSpace: "pre-wrap" }}>{po.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ margin: "24px 32px 0", padding: "12px 0", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#aaa" }}>
          <span>Generated by PODesk</span>
          <span>{companyName} · {new Date().toLocaleDateString("en", { dateStyle: "medium" })}</span>
        </div>
      </div>
    </>
  );
}

function Field({
  label, name, type = "text", required = false, defaultValue, step, placeholder,
}: {
  label: string; name: string; type?: string; required?: boolean; defaultValue?: string; step?: string; placeholder?: string;
}) {
  return (
    <label style={fieldLabelStyle}>
      {label}
      <input name={name} type={type} required={required} defaultValue={defaultValue} step={step} placeholder={placeholder} style={inputStyle} />
    </label>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s.length > 0 ? s : null;
}

function dateFromForm(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s ? new Date(`${s}T00:00:00.000Z`) : null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function statusBadge(status: string) {
  const colors: Record<string, { bg: string; color: string }> = {
    DRAFT: { bg: "#f4f6f8", color: "#6d7175" },
    SENT: { bg: "#eaf5fe", color: "#1f5199" },
    CONFIRMED: { bg: "#effaf5", color: "#0f5132" },
    PARTIALLY_RECEIVED: { bg: "#fff7ed", color: "#8a5a00" },
    RECEIVED: { bg: "#effaf5", color: "#0f5132" },
    DELAYED: { bg: "#fff4f4", color: "#8a1f11" },
    CANCELLED: { bg: "#f4f6f8", color: "#6d7175" },
  };
  const c = colors[status] ?? { bg: "#f4f6f8", color: "#6d7175" };
  return { background: c.bg, color: c.color, padding: "3px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, display: "inline-block" } as const;
}


// Modern Premium Styles
const pageContainerStyle = { padding: "32px", maxWidth: "1600px", margin: "0 auto", width: "100%", boxSizing: "border-box" } as const;
const mainGridStyle = { display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.3fr)", gap: "32px", alignItems: "start" } as const;
const colStyle = { display: "grid", gap: "24px" } as const;

const cardStyle = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "16px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.025)", overflow: "hidden", transition: "box-shadow 0.3s ease" } as const;
const cardHeaderStyle = { margin: 0, padding: "20px 24px", fontSize: "16px", fontWeight: 700, color: "#111827", borderBottom: "1px solid #f3f4f6", backgroundColor: "#f9fafb" } as const;
const cardContentStyle = { padding: "24px" } as const;

const metaGridStyle = { display: "grid", gridTemplateColumns: "1fr", gap: "12px", marginBottom: "12px" } as const;
const fieldLabelStyle = { display: "grid", gap: "8px", color: "#374151", fontSize: "14px", fontWeight: 600 } as const;
const inputStyle = { border: "1px solid #d1d5db", borderRadius: "8px", padding: "10px 14px", fontSize: "14px", width: "100%", boxSizing: "border-box", outline: "none", transition: "border-color 0.2s, box-shadow 0.2s" } as const;
const textareaStyle = { ...inputStyle, resize: "vertical" } as const;

const buttonStyle = buttonPrimaryStyle;
const dangerBtnStyle = buttonDangerStyle;
const smallBtnStyle = buttonSmallStyle;
const statusBtn = buttonSmallStyle;
const linkStyle = { color: "#008060", textDecoration: "none", fontWeight: 500 } as const;
const printBtnLinkStyle = buttonPrimaryStyle;
const secondaryBtnLinkStyle = buttonSecondaryStyle;

const tableWrapStyle = { overflowX: "auto", margin: "-24px", padding: "24px" } as const;
const tableStyle = { width: "100%", borderCollapse: "separate", borderSpacing: "0", fontSize: "14px" } as const;
const thStyle = { textAlign: "left", borderBottom: "1px solid #e5e7eb", padding: "16px 12px", whiteSpace: "nowrap", color: "#6b7280", fontSize: "13px", fontWeight: 600, backgroundColor: "#f9fafb", borderTop: "1px solid #e5e7eb" } as const;
const tdStyle = { borderBottom: "1px solid #f3f4f6", padding: "16px 12px", verticalAlign: "middle", color: "#111827" } as const;
const mutedStyle = { color: "#6b7280", fontSize: "13px", marginTop: "4px" } as const;

const noticeStyle = (ok: boolean) => ({ border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`, background: ok ? "#f0fdf4" : "#fef2f2", borderRadius: "8px", marginBottom: "20px", padding: "16px 20px", color: ok ? "#166534" : "#991b1b", fontWeight: 500, fontSize: "14px" }) as const;

const cardMetricStyle = { border: "1px solid #e5e7eb", borderRadius: "12px", padding: "20px", background: "#ffffff", boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" } as const;
const metricLabelStyle = { color: "#6b7280", fontSize: "13px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" } as const;
const metricValueStyle = { marginTop: "8px", fontSize: "28px", fontWeight: 800, color: "#111827", letterSpacing: "-0.02em" } as const;
const progressTrackStyle = { width: "100%", background: "#f3f4f6", borderRadius: "999px", height: "10px", marginTop: "16px", overflow: "hidden" } as const;
const progressBarFillStyle = { background: "#000000", height: "100%", transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)" } as const;
const completeBadgeStyle = { background: "#f0fdf4", color: "#166534", padding: "6px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, display: "inline-block" } as const;
const receivingGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "20px", marginBottom: "20px" } as const;
const mutedBannerStyle = { border: "1px solid #e5e7eb", background: "#f9fafb", color: "#4b5563", padding: "16px", borderRadius: "12px", fontSize: "14px", fontWeight: 500, marginTop: "16px" } as const;

// react-select custom styles
const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    border: state.isFocused ? "1px solid #000" : "1px solid #d1d5db",
    boxShadow: state.isFocused ? "0 0 0 1px #000" : "none",
    borderRadius: "8px",
    padding: "4px",
    fontSize: "14px",
    "&:hover": { border: "1px solid #000" }
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected ? "#000" : state.isFocused ? "#f3f4f6" : "transparent",
    color: state.isSelected ? "#fff" : "#111827",
    cursor: "pointer",
    fontSize: "14px"
  }),
};

// Shopify requires ErrorBoundary
export function ErrorBoundary() {
  const error = useRouteError();
  if (error instanceof Response && (error.status === 200 || error.status === 401)) {
    return boundary.error(error);
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
