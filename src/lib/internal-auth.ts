/**
 * HMAC-SHA256 verification for the internal agent API (Phase 6 — ADR-034).
 *
 * The `pulse-agent` container signs `${timestamp}.${body}` with the shared
 * `INTERNAL_API_SECRET` and sends `x-agent-signature` / `x-agent-timestamp`.
 */
import crypto from "crypto";

const INTERNAL_API_SECRET =
  process.env.INTERNAL_API_SECRET || "pulse-internal-secret-key-change-in-prod";
const MAX_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

export function verifyInternalSignature(headers: Headers, bodyString: string): boolean {
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
