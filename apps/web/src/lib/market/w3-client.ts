// How the contact side's components (W3) ask the site's own Marketplace routes from the browser. The account is the
// HttpOnly cookie's, sent by the browser itself: nothing here ever holds an id or a token. An answer is never kept, and
// one that cannot be read, or no answer at all, is the "generic" refusal (lib/market/w3.ts mkReply).
import { mkReply, type MkReply } from "./w3";

async function ask<T>(path: string, init: RequestInit): Promise<MkReply<T>> {
  try {
    const r = await fetch(path, { cache: "no-store", credentials: "same-origin", ...init });
    return mkReply<T>(await r.json().catch(() => null));
  } catch {
    return mkReply<T>(null);
  }
}
/** A read: GET /api/market/... */
export const mkGet = <T,>(path: string): Promise<MkReply<T>> => ask<T>(path, { method: "GET" });
/** A change: POST /api/market/... with a JSON body. */
export const mkPost = <T,>(path: string, body: Record<string, unknown>): Promise<MkReply<T>> =>
  ask<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
