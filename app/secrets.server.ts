import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const SECRET_PREFIX = "enc:v1:";

function getSecretKey() {
  const secret = process.env.EMAIL_CREDENTIAL_SECRET || process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    throw new Error("EMAIL_CREDENTIAL_SECRET or SHOPIFY_API_SECRET must be set to protect email credentials.");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(value: string | null) {
  if (!value || value.startsWith(SECRET_PREFIX)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${SECRET_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith(SECRET_PREFIX)) return value;

  const payload = value.slice(SECRET_PREFIX.length);
  const [ivText, tagText, encryptedText] = payload.split(".");
  if (!ivText || !tagText || !encryptedText) {
    throw new Error("Stored email credential is malformed.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getSecretKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
