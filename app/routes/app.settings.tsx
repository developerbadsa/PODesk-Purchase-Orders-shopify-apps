import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, useLoaderData, useNavigation, useRouteError } from "react-router";
import { useState } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdmin } from "../authenticate-admin.server";
import prisma from "../db.server";

type ActionData = { ok: boolean; message: string };
const SUPPLIER_EMAIL_AUTOMATION_MODES = [
  "REVIEW_BEFORE_SEND",
  "AUTO_SEND_AFTER_REVIEW",
] as const;

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
    const companyName = String(formData.get("companyName") || "").trim();
    const contactEmail = String(formData.get("contactEmail") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const addressLine1 = String(formData.get("addressLine1") || "").trim();
    const addressLine2 = String(formData.get("addressLine2") || "").trim();
    const city = String(formData.get("city") || "").trim();
    const region = String(formData.get("region") || "").trim();
    const postalCode = String(formData.get("postalCode") || "").trim();
    const country = String(formData.get("country") || "").trim();
    const currencyCode = String(formData.get("currencyCode") || "USD").trim().toUpperCase();
    const defaultPaymentTerms = String(formData.get("defaultPaymentTerms") || "").trim();
    const defaultPoNotes = String(formData.get("defaultPoNotes") || "").trim();
    let poNumberPrefix = String(formData.get("poNumberPrefix") || "PO").trim().toUpperCase();
    const supplierEmailAutomationMode = String(formData.get("supplierEmailAutomationMode") || "REVIEW_BEFORE_SEND") as any;
    const emailProvider = String(formData.get("emailProvider") || "SMTP") as any;
    
    const resendApiKey = String(formData.get("resendApiKey") || "").trim();
    const resendFromEmail = String(formData.get("resendFromEmail") || "").trim();
    
    const smtpHost = String(formData.get("smtpHost") || "").trim();
    const smtpPortRaw = String(formData.get("smtpPort") || "").trim();
    const smtpPort = smtpPortRaw ? parseInt(smtpPortRaw, 10) : null;
    const smtpUser = String(formData.get("smtpUser") || "").trim();
    const smtpPassword = String(formData.get("smtpPassword") || "").trim();

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
        supplierEmailAutomationMode,
        emailProvider,
        resendApiKey: resendApiKey || null,
        resendFromEmail: resendFromEmail || null,
        smtpHost: smtpHost || null,
        smtpPort,
        smtpUser: smtpUser || null,
        smtpPassword: smtpPassword || null,
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
        supplierEmailAutomationMode,
        emailProvider,
        resendApiKey: resendApiKey || null,
        resendFromEmail: resendFromEmail || null,
        smtpHost: smtpHost || null,
        smtpPort,
        smtpUser: smtpUser || null,
        smtpPassword: smtpPassword || null,
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
  
  const [provider, setProvider] = useState(settings?.emailProvider || "SMTP");

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

        <s-section heading="Supplier email automation">
          <div style={formCardStyle}>
            <div style={sectionIntroStyle}>
              <div style={sectionTitleStyle}>Email sending workflow</div>
              <p style={sectionTextStyle}>
                Choose how PODesk should handle supplier emails after a purchase
                order is reviewed. PODesk will not send supplier emails just
                because a draft PO was created.
              </p>
            </div>

            <div style={radioGridStyle}>
              <label htmlFor="supplier-email-review" style={radioCardStyle}>
                <input
                  id="supplier-email-review"
                  type="radio"
                  name="supplierEmailAutomationMode"
                  value={SUPPLIER_EMAIL_AUTOMATION_MODES[0]}
                  aria-label="Review before sending supplier emails"
                  defaultChecked={
                    (settings?.supplierEmailAutomationMode ??
                      "REVIEW_BEFORE_SEND") === "REVIEW_BEFORE_SEND"
                  }
                  style={radioInputStyle}
                />
                <span>
                  <span style={radioTitleStyle}>Review before sending</span>
                  <span style={radioTextStyle}>
                    PODesk prepares the email draft. The merchant opens the
                    email, reviews it, sends it, then marks the PO as sent.
                  </span>
                </span>
              </label>

              <label htmlFor="supplier-email-auto-send" style={radioCardStyle}>
                <input
                  id="supplier-email-auto-send"
                  type="radio"
                  name="supplierEmailAutomationMode"
                  value={SUPPLIER_EMAIL_AUTOMATION_MODES[1]}
                  aria-label="Auto-send supplier emails after review"
                  defaultChecked={
                    settings?.supplierEmailAutomationMode ===
                    "AUTO_SEND_AFTER_REVIEW"
                  }
                  style={radioInputStyle}
                />
                <span>
                  <span style={radioTitleStyle}>Auto-send after review</span>
                  <span style={radioTextStyle}>
                    The merchant still reviews the PO first. After confirmation,
                    PODesk can send the supplier email automatically when email
                    delivery is connected.
                  </span>
                </span>
              </label>
            </div>

            <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #dfe3e8" }}>
              <div style={{ ...sectionTitleStyle, fontSize: "14px", marginBottom: "16px" }}>Email Delivery Configuration</div>
              
              <div style={{ marginBottom: "20px" }}>
                <label style={fieldLabelStyle}>
                  Email Provider
                  <select
                    name="emailProvider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="SMTP">Custom SMTP (Easy - Gmail, Outlook, cPanel)</option>
                    <option value="RESEND">Resend.com (Advanced)</option>
                  </select>
                </label>
              </div>

              {provider === "SMTP" ? (
                <>
                  <p style={{ ...sectionTextStyle, marginBottom: "16px" }}>
                    Enter your custom SMTP credentials to send emails directly from your own email account. 
                    If using Gmail, use an <a href="https://support.google.com/accounts/answer/185833?hl=en" target="_blank" rel="noreferrer" style={{color: "#005bd3", textDecoration: "none"}}>App Password</a>.
                  </p>
                  <div style={formGridStyle}>
                    <Field
                      label="SMTP Host (e.g. smtp.gmail.com)"
                      name="smtpHost"
                      defaultValue={settings?.smtpHost ?? ""}
                      placeholder="smtp.gmail.com"
                    />
                    <Field
                      label="SMTP Port (e.g. 465 or 587)"
                      name="smtpPort"
                      type="number"
                      defaultValue={settings?.smtpPort?.toString() ?? ""}
                      placeholder="465"
                    />
                    <Field
                      label="SMTP Username (Your Email)"
                      name="smtpUser"
                      type="email"
                      defaultValue={settings?.smtpUser ?? ""}
                      placeholder="you@gmail.com"
                    />
                    <Field
                      label="SMTP Password / App Password"
                      name="smtpPassword"
                      type="password"
                      defaultValue={settings?.smtpPassword ?? ""}
                      placeholder="••••••••"
                    />
                  </div>
                </>
              ) : (
                <>
                  <p style={{ ...sectionTextStyle, marginBottom: "16px" }}>
                    To enable auto-sending, you must provide your own API key from <a href="https://resend.com" target="_blank" rel="noreferrer" style={{color: "#005bd3", textDecoration: "none"}}>Resend.com</a> and a verified sender email address.
                  </p>
                  <div style={formGridStyle}>
                    <Field
                      label="Resend API Key"
                      name="resendApiKey"
                      type="password"
                      defaultValue={settings?.resendApiKey ?? ""}
                      placeholder="re_..."
                    />
                    <Field
                      label="Verified Sender Email"
                      name="resendFromEmail"
                      type="email"
                      defaultValue={settings?.resendFromEmail ?? ""}
                      placeholder="orders@yourdomain.com"
                    />
                  </div>
                </>
              )}
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
const sectionIntroStyle = {
  borderBottom: "1px solid #e1e3e5",
  paddingBottom: "14px",
  marginBottom: "16px",
} as const;
const sectionTitleStyle = {
  color: "#202223",
  fontSize: "15px",
  fontWeight: 700,
} as const;
const sectionTextStyle = {
  margin: "4px 0 0",
  color: "#616161",
  fontSize: "13px",
  lineHeight: 1.45,
  maxWidth: "720px",
} as const;
const radioGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "12px",
} as const;
const radioCardStyle = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  gap: "10px",
  alignItems: "start",
  border: "1px solid #dfe3e8",
  borderRadius: "8px",
  background: "#ffffff",
  padding: "14px",
  cursor: "pointer",
} as const;
const radioInputStyle = {
  width: "16px",
  height: "16px",
  marginTop: "2px",
  accentColor: "#008060",
} as const;
const radioTitleStyle = {
  display: "block",
  color: "#202223",
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: 1.35,
} as const;
const radioTextStyle = {
  display: "block",
  color: "#6d7175",
  fontSize: "13px",
  lineHeight: 1.45,
  marginTop: "4px",
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
  const boundaryError = boundary.error(error);
  if (error instanceof Response && (error.status === 200 || error.status === 401)) {
    return boundaryError;
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


