import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

type ActionData = { ok: boolean; message: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  let store = await prisma.store.findUnique({
    where: { shop: session.shop },
    include: { settings: true },
  });

  if (!store) {
    store = await prisma.store.create({
      data: { shop: session.shop },
      include: { settings: true },
    });
  }

  let settings = store.settings;
  if (!settings) {
    settings = await prisma.storeSettings.create({
      data: {
        storeId: store.id,
        companyName: store.name ?? null,
        poNumberPrefix: "PO",
        currencyCode: "USD",
      },
    });
  }

  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const store = await prisma.store.upsert({
    where: { shop: session.shop },
    update: {},
    create: { shop: session.shop },
  });

  const formData = await request.formData();
  const intent = String(formData.get("intent") || "");

  if (intent === "save-settings") {
    const companyName = optionalString(formData.get("companyName"));
    const contactEmail = optionalString(formData.get("contactEmail"));
    const phone = optionalString(formData.get("phone"));
    const addressLine1 = optionalString(formData.get("addressLine1"));
    const addressLine2 = optionalString(formData.get("addressLine2"));
    const city = optionalString(formData.get("city"));
    const region = optionalString(formData.get("region"));
    const postalCode = optionalString(formData.get("postalCode"));
    const country = optionalString(formData.get("country"));
    const currencyCode = String(formData.get("currencyCode") || "USD").trim().toUpperCase();
    const defaultPaymentTerms = optionalString(formData.get("defaultPaymentTerms"));
    const defaultPoNotes = optionalString(formData.get("defaultPoNotes"));
    let poNumberPrefix = String(formData.get("poNumberPrefix") || "PO").trim().toUpperCase();

    // Validation 1: currencyCode must be uppercase 3-letter code
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      return {
        ok: false,
        message: "Currency code must be a valid uppercase 3-letter code (e.g. USD, CAD, EUR, GBP).",
      } satisfies ActionData;
    }

    // Validation 2: contactEmail can be blank, but if provided must look valid
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return {
        ok: false,
        message: "Contact email must be a valid email address.",
      } satisfies ActionData;
    }

    // Validation 3: poNumberPrefix should be short and safe (max 10 alphanumeric/hyphen/underscore)
    poNumberPrefix = poNumberPrefix.replace(/[^A-Z0-9_-]/g, "");
    if (!poNumberPrefix) {
      poNumberPrefix = "PO";
    } else if (poNumberPrefix.length > 10) {
      return {
        ok: false,
        message: "PO number prefix must be 10 characters or fewer.",
      } satisfies ActionData;
    }

    await prisma.storeSettings.upsert({
      where: { storeId: store.id },
      update: {
        companyName,
        contactEmail,
        phone,
        addressLine1,
        addressLine2,
        city,
        region,
        postalCode,
        country,
        currencyCode,
        defaultPaymentTerms,
        defaultPoNotes,
        poNumberPrefix,
      },
      create: {
        storeId: store.id,
        companyName,
        contactEmail,
        phone,
        addressLine1,
        addressLine2,
        city,
        region,
        postalCode,
        country,
        currencyCode,
        defaultPaymentTerms,
        defaultPoNotes,
        poNumberPrefix,
      },
    });

    return { ok: true, message: "Settings saved successfully." } satisfies ActionData;
  }

  return { ok: false, message: "Unknown action." } satisfies ActionData;
};

export default function SettingsPage() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <s-page heading="Settings">
      {actionData?.message ? (
        <div style={noticeStyle(actionData.ok)}>{actionData.message}</div>
      ) : null}

      <Form method="post">
        <input type="hidden" name="intent" value="save-settings" />

        <s-section heading="Business identity">
          <div style={formGridStyle}>
            <Field label="Company name" name="companyName" defaultValue={settings?.companyName ?? ""} />
            <Field label="Contact email" name="contactEmail" type="email" defaultValue={settings?.contactEmail ?? ""} />
            <Field label="Phone" name="phone" defaultValue={settings?.phone ?? ""} />
            <Field label="Address line 1" name="addressLine1" defaultValue={settings?.addressLine1 ?? ""} />
            <Field label="Address line 2" name="addressLine2" defaultValue={settings?.addressLine2 ?? ""} />
            <Field label="City" name="city" defaultValue={settings?.city ?? ""} />
            <Field label="State / Region" name="region" defaultValue={settings?.region ?? ""} />
            <Field label="Postal code" name="postalCode" defaultValue={settings?.postalCode ?? ""} />
            <Field label="Country" name="country" defaultValue={settings?.country ?? ""} />
          </div>
        </s-section>

        <s-section heading="Purchase order defaults">
          <div style={formGridStyle}>
            <Field
              label="PO reference prefix"
              name="poNumberPrefix"
              defaultValue={settings?.poNumberPrefix ?? "PO"}
            />
            <Field
              label="Default payment terms"
              name="defaultPaymentTerms"
              defaultValue={settings?.defaultPaymentTerms ?? ""}
            />
          </div>
          <label style={fieldLabelStyle}>
            Default PO notes
            <textarea
              name="defaultPoNotes"
              rows={3}
              style={textareaStyle}
              defaultValue={settings?.defaultPoNotes ?? ""}
            />
          </label>
        </s-section>

        <s-section heading="Localization">
          <div style={formGridStyle}>
            <Field
              label="Currency code (e.g. USD, CAD, EUR, GBP)"
              name="currencyCode"
              defaultValue={settings?.currencyCode ?? "USD"}
              required
            />
          </div>
        </s-section>

        <div style={{ marginTop: "16px", marginBottom: "32px" }}>
          <button type="submit" disabled={isSubmitting} style={buttonStyle}>
            {isSubmitting ? "Saving..." : "Save settings"}
          </button>
        </div>
      </Form>
    </s-page>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label style={fieldLabelStyle}>
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        style={inputStyle}
      />
    </label>
  );
}

function optionalString(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s.length > 0 ? s : null;
}

// Styles
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
const textareaStyle = { ...inputStyle, resize: "vertical" } as const;
const buttonStyle = {
  border: "0",
  borderRadius: "6px",
  padding: "10px 18px",
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
    marginBottom: "12px",
    padding: "10px 12px",
    color: ok ? "#0f5132" : "#8a1f11",
  }) as const;

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
