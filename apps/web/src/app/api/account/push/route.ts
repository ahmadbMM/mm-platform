import { ACCOUNT_COOKIE, decodeSession, sameOrigin } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { cookieValue } from "@/lib/live";
import { cleanPushRequest } from "@/lib/push";

// POST /api/account/push {action: "subscribe", endpoint, keys: {p256dh, auth}, old?} or
// {action: "unsubscribe", endpoint}: the Account page's Notifications switch (and the service
// worker, when the push service replaces a subscription) registers or removes this browser for
// the signed-in rider, through the booking app's customer_push_subscribe /
// customer_push_unsubscribe with the account cookie's id and token - the same rows the booking
// app writes, so its /api/push-send reaches this browser too. Only this site may call it.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return json({ ok: false, error: "origin" }, 403);
  const acct = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  if (!acct) return json({ ok: false, error: "signin" }, 401);
  let body: unknown = null;
  try { body = await req.json(); } catch { /* empty body */ }
  const p = cleanPushRequest(body);
  if (!p) return json({ ok: false, error: "invalid" }, 400);

  const who = { p_id: acct.id, p_token: acct.token };
  const r = p.action === "subscribe"
    ? await rpcServer<boolean>("customer_push_subscribe", { ...who, p_endpoint: p.endpoint, p_p256dh: p.p256dh, p_auth: p.auth, p_ua: (req.headers.get("user-agent") || "").slice(0, 200) })
    : await rpcServer<boolean>("customer_push_unsubscribe", { ...who, p_endpoint: p.endpoint });
  if (r.status === 0 || r.status >= 500) return json({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return json({ ok: false, error: "generic" }, 502);
  // Both functions answer false for a token the booking app no longer accepts; subscribe also
  // for a full account (over 20 browsers) - either way the rider signs in again or is told.
  if (r.data === false) return json({ ok: false, error: p.action === "subscribe" ? "refused" : "signin" }, p.action === "subscribe" ? 409 : 401);
  // A replaced subscription (pushsubscriptionchange): the old endpoint is dead; drop its row now
  // rather than when a send finds it gone. Best effort.
  if (p.action === "subscribe" && p.old) await rpcServer("customer_push_unsubscribe", { ...who, p_endpoint: p.old });
  return json({ ok: true });
}
