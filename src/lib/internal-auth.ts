/**
 * HMAC-SHA256 verification for the internal agent API (Phase 6 — ADR-034).
 *
 * The `pulse-agent` container signs `${timestamp}.${body}` with the shared
 * `INTERNAL_API_SECRET` and sends `x-agent-signature` / `x-agent-timestamp`.
 */
import crypto from "crypto";

const DEV_FALLBACK_SECRET = "pulse-internal-secret-key-change-in-prod";
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || DEV_FALLBACK_SECRET;
const MAX_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

// The fallback secret is public in the repository: in production it must never
// authenticate anything, so a missing/default secret fails closed.
const IS_INSECURE_PRODUCTION_SECRET =
  process.env.NODE_ENV === "production" && INTERNAL_API_SECRET === DEV_FALLBACK_SECRET;
let insecureSecretWarned = false;

export function verifyInternalSignature(headers: Headers, bodyString: string): boolean {
  if (IS_INSECURE_PRODUCTION_SECRET) {
    if (!insecureSecretWarned) {
      insecureSecretWarned = true;
      console.error(
        "[internal-auth] INTERNAL_API_SECRET is unset or uses the public default; rejecting all internal agent requests.",
      );
    }
    return false;
  }

  const signature = headers.get("x-agent-signature");
  const timestampStr = headers.get("x-agent-timestamp");

  if (!signature || !timestampStr) {
    return false;
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  const now = Date.now();
  if (Math.abs(now - timestamp) > MAX_DRIFT_MS) {
    return false; // replay attack protection
  }

  const message = `${timestamp}.${bodyString}`;
  const expectedSignature = crypto
    .createHmac("sha256", INTERNAL_API_SECRET)
    .update(message)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex"),
    );
  } catch {
    return false;
  }
}
