import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { cookieValue } from "@/lib/live";

// GET /api/account/hub-photo?post=<id>: the Saturday report's photo on /club (components/club/HubCards.tsx; the booking
// app's _hubPostImg), read through hub_post_img with the account cookie's id and token: a Community member alone gets it,
// and only while the report shows (never a hidden one). The database keeps it as a JPEG data address; it is sent as the
// picture itself, kept by this browser alone for ten minutes. 404 for anything else (signed out, not a member, no photo,
// no answer), and the page then draws the report without it.
export const dynamic = "force-dynamic";

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const PREFIX = "data:image/jpeg;base64,";
const none = () => new Response(null, { status: 404, headers: { "cache-control": "no-store" } });

export async function GET(req: Request) {
  const s = decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));
  const post = new URL(req.url).searchParams.get("post") ?? "";
  if (!s || !ID.test(post)) return none();
  const r = await rpcServer<unknown>("hub_post_img", { p_id: s.id, p_token: s.token, p_post: post }, 8000);
  const d = r.status === 200 && typeof r.data === "string" && r.data.startsWith(PREFIX) ? r.data.slice(PREFIX.length) : "";
  if (!d || d.length > 8_000_000 || !/^[A-Za-z0-9+/]+=*$/.test(d)) return none();
  let bytes: ArrayBuffer;
  try { bytes = Uint8Array.from(atob(d), (c) => c.charCodeAt(0)).buffer; } catch { return none(); }
  return new Response(bytes, {
    status: 200,
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=600", "x-content-type-options": "nosniff" },
  });
}
