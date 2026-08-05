import { recoverFromInvalidEmbeddedSession } from "./auth-recovery.server";
import {
  logAuthFailure,
  logAuthRequest,
  logAuthSuccess,
} from "./auth-diagnostics.server";
import { authenticate } from "./shopify.server";

export type AdminAuthResult = Awaited<ReturnType<typeof authenticate.admin>>;

export async function authenticateAdmin(
  request: Request,
  label: string
): Promise<AdminAuthResult> {
  logAuthRequest(`${label}:start`, request);

  try {
    const result = await authenticate.admin(request);
    logAuthSuccess(`${label}:success`, request, result.session.shop);
    return result;
  } catch (error) {
    logAuthFailure(`${label}:thrown`, request, error);
    const recoveryResponse = recoverFromInvalidEmbeddedSession(request, error);

    if (recoveryResponse) {
      throw recoveryResponse;
    }

    throw error;
  }
}
