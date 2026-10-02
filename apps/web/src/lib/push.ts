// Web Push on the website: what the Account page's Notifications switch sends to
// /api/account/push, checked before it reaches the database (customer_push_subscribe /
// customer_push_unsubscribe, the booking app's own functions, which check the account's token).

export type PushRequest =
  | { action: "subscribe"; endpoint: string; p256dh: string; auth: string; old: string | null }
  | { action: "unsubscribe"; endpoint: string };

const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** A push service's address: https, of a sane length. Browsers only hand out https endpoints. */
export function cleanEndpoint(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 1024) return null;
  try { return new URL(v).protocol === "https:" ? v : null; } catch { return null; }
}

// p256dh is a P-256 public key (65 bytes, 87 characters of base64url); auth is 16 bytes (22).
const key = (v: unknown, min: number, max: number) =>
  typeof v === "string" && v.length >= min && v.length <= max && B64URL.test(v) ? v.replace(/=+$/, "") : null;

/** The body of a POST to /api/account/push, or null when it is not one. */
export function cleanPushRequest(body: unknown): PushRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { action?: unknown; endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null; old?: unknown };
  const endpoint = cleanEndpoint(b.endpoint);
  if (!endpoint) return null;
  if (b.action === "unsubscribe") return { action: "unsubscribe", endpoint };
  if (b.action !== "subscribe") return null;
  const p256dh = key(b.keys?.p256dh, 80, 100);
  const auth = key(b.keys?.auth, 16, 32);
  if (!p256dh || !auth) return null;
  const old = cleanEndpoint(b.old);
  return { action: "subscribe", endpoint, p256dh, auth, old: old && old !== endpoint ? old : null };
}
