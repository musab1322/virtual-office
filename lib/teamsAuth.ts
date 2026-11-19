import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * يتحقق من توقيع Outgoing Webhook في Teams.
 * Teams يرسل الترويسة: Authorization: HMAC <base64>
 * والتوقيع = HMAC-SHA256(النص الخام للطلب) بمفتاح = Base64-decode(رمز الأمان الذي يظهر عند إنشاء الـ webhook).
 */
export function verifyTeamsHmac(rawBody: string, authHeader: string | null): boolean {
  const secret = process.env.TEAMS_OUTGOING_WEBHOOK_SECRET;
  if (!secret || !authHeader?.startsWith("HMAC ")) return false;

  const provided = Buffer.from(authHeader.slice(5).trim(), "base64");
  const expected = createHmac("sha256", Buffer.from(secret, "base64"))
    .update(Buffer.from(rawBody, "utf8"))
    .digest();

  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
