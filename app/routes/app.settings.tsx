import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation , useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";

type ActionData = { ok: boolean; message: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdmin(request, "settings-loader");
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
  const { session } = await authenticateAdmin(request, "settings-action");
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
          <div style={formCardStyle}>
            <div style={formGridStyle}>
              <Field label="Company name" name="companyName" defaultValue={settings?.companyName ?? ""} placeholder="e.g. Acme Retail Ltd." />
              <Field label="Contact email" name="contactEmail" type="email" defaultValue={settings?.contactEmail ?? ""} placeholder="purchasing@acmeretail.com" />
              <Field label="Phone" name="phone" defaultValue={settings?.phone ?? ""} placeholder="+1 (555) 019-2834" />
              <Field label="Address line 1" name="addressLine1" defaultValue={settings?.addressLine1 ?? ""} placeholder="123 Commerce Way" />
              <Field label="Address line 2" name="addressLine2" defaultValue={settings?.addressLine2 ?? ""} placeholder="Suite 400" />
              <Field label="City" name="city" defaultValue={settings?.city ?? ""} placeholder="New York" />
              <Field label="State / Region" name="region" defaultValue={settings?.region ?? ""} placeholder="NY" />
              <Field label="Postal code" name="postalCode" defaultValue={settings?.postalCode ?? ""} placeholder="10001" />
              <Field label="Country" name="country" defaultValue={settings?.country ?? ""} placeholder="United States" />
            </div>
          </div>
        </s-section>

        <s-section heading="Purchase order defaults">
          <div style={formCardStyle}>
            <div style={formGridStyle}>
              <Field
                label="PO reference prefix"
                name="poNumberPrefix"
                defaultValue={settings?.poNumberPrefix ?? "PO"}
                placeholder="PO"
              />
              <Field
                label="Default payment terms"
                name="defaultPaymentTerms"
                defaultValue={settings?.defaultPaymentTerms ?? ""}
                placeholder="e.g. Net 30"
              />
            </div>
            <div style={{ marginTop: "16px" }}>
              <label style={fieldLabelStyle}>
                <span>Default PO notes</span>
                <textarea
                  name="defaultPoNotes"
                  rows={3}
                  placeholder="Standard notes printed on all purchase orders..."
                  style={textareaStyle}
                  defaultValue={settings?.defaultPoNotes ?? ""}
                />
              </label>
            </div>
          </div>
        </s-section>

        <s-section heading="Localization">
          <div style={formCardStyle}>
            <div style={formGridStyle}>
              <Field
                label="Currency code (e.g. USD, CAD, EUR, GBP)"
                name="currencyCode"
                defaultValue={settings?.currencyCode ?? "USD"}
                required
                placeholder="USD"
              />
            </div>
          </div>
        </s-section>

        <div style={{ marginTop: "20px", marginBottom: "32px" }}>
          <button type="submit" disabled={isSubmitting} style={buttonStyle}>
            {isSubmitting ? "Saving settings..." : "Save settings"}
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
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label style={fieldLabelStyle}>
      <span>{label} {required ? <span style={{ color: "#d72c0d" }}>*</span> : null}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
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
const formCardStyle = {
  background: "#ffffff",
  border: "1px solid #e1e3e5",
  borderRadius: "10px",
  padding: "20px 24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
} as const;
const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: "16px",
} as const;
const fieldLabelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  color: "#202223",
  fontSize: "13px",
  fontWeight: 600,
} as const;
const inputStyle = {
  height: "40px",
  border: "1px solid #8c9196",
  borderRadius: "8px",
  padding: "0 12px",
  fontSize: "14px",
  width: "100%",
  backgroundColor: "#ffffff",
  outline: "none",
  boxSizing: "border-box",
} as const;
const textareaStyle = {
  ...inputStyle,
  height: "auto",
  minHeight: "80px",
  padding: "10px 12px",
  resize: "vertical",
} as const;
const buttonStyle = {
  height: "40px",
  border: "0",
  borderRadius: "8px",
  padding: "0 24px",
  background: "#008060",
  color: "#fff",
  fontWeight: 650,
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
} as const;
const noticeStyle = (ok: boolean) =>
  ({
    border: `1px solid ${ok ? "#95c9b4" : "#e0b3b2"}`,
    background: ok ? "#effaf5" : "#fff4f4",
    borderRadius: "8px",
    marginTop: "12px",
    marginBottom: "12px",
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
