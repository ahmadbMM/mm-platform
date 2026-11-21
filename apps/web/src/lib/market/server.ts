import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import { ACCOUNT_COOKIE, decodeSession, type Session } from "../account-core";
import { forVisitor, rpcServer } from "../account";
import { edgeScope, edgeStore, memo } from "../memo";
import {
  mkBrowseOf, mkCategory, mkErrorOf, mkHasId, mkIsObj, mkSmallName, isMkPhotoName,
  type MkAction, type MkBrowse, type MkBrowseQuery, type MkCategory, type MkCommission, type MkError, type MkIndex,
  type MkLimits, type MkListing, type MkListingFields, type MkListingMine, type MkMe, type MkMessage, type MkNameMode,
  type MkReportReason, type MkReportTarget, type MkShop, type MkShopContact, type MkShopFields, type MkShopMine,
  type MkShopRow, type MkThreadGet, type MkThreadRow,
} from "./core";

// The Marketplace on the server (lib/market/core.ts has the shapes and the plain rules; this file is never sent to a
// browser): one typed call per database function of the build's contract, over lib/account.ts rpcServer with the
// public key. An account's calls carry the id and token of its own session - from the HttpOnly cookie, never from
// anything the browser sends - and the database checks them itself. A refusal comes back as the site's error id, the
// detail after the code's colon and the HTTP status a route answers (core.ts mkErrorOf). A database without the
// marketplace yet (the migration is not applied) answers "absent", never an error page.
export { marketplaceOn, MARKET_TEST_ON } from "../site";
export { mkSettings } from "./core";

/** What every call answers: the function's own answer, or why not. */
export type MkResult<T> = { ok: true; data: T } | { ok: false; error: MkError; detail: string; status: number };

type Opts = {
  /** The visitor's request, so a function the database meters per address counts theirs (lib/account.ts forVisitor). */
  req?: Request;
  timeout?: number;
  /** Whether the answer is of the shape expected; one that is not reads as "generic". */
  shape?: (v: unknown) => boolean;
};

async function call<T>(fn: string, args: Record<string, unknown>, o: Opts = {}): Promise<MkResult<T>> {
  const r = await rpcServer<unknown>(fn, o.req ? forVisitor(o.req, args) : args, o.timeout ?? 6000);
  if (r.status >= 200 && r.status < 300) {
    if (o.shape && !o.shape(r.data)) return { ok: false, error: "generic", detail: "", status: 502 };
    return { ok: true, data: r.data as T };
  }
  return { ok: false, ...mkErrorOf(r) };
}
const who = (s: Session) => ({ p_id: s.id, p_token: s.token });
const obj = mkIsObj;
const orNull = (check: (v: unknown) => boolean) => (v: unknown) => v === null || check(v);
const hasList = (k: string) => (v: unknown) => obj(v) && Array.isArray(v[k]);

/** The account cookie's session in a page (a server component), or null. In a route, lib/market/route.ts marketGuard. */
export async function mkSession(): Promise<Session | null> {
  return decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
}

/* ------------------------------------------------------------------ public reads */

const TTL_MS = 60_000; // a staff edit of the categories shows within a minute, as every staff edit does

/** The categories people can list under (market_categories, the visible rows), kept a minute and at the edge as the
 *  site's other public reads are. The empty list when the database has no such table yet or has never answered. */
export async function loadMarketCategories(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<MkCategory[]> {
  const list = await memo<MkCategory[]>(`market:cats:${edgeScope()}`, {
    ttl: TTL_MS, now, keep: edgeStore<MkCategory[]>("market-cats"),
    read: async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) return null;
      try {
        const res = await fetchImpl(`${url}/rest/v1/market_categories?select=slug,parent,name_en,name_ar,sort,tier,needs_serial,min_photos,facts&visible=is.true&order=sort.asc`, {
          headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(4000),
        });
        if (res.status >= 400 && res.status < 500) return []; // no such table yet: nothing to list under
        if (!res.ok) return null;
        const rows = (await res.json()) as unknown;
        return Array.isArray(rows) ? rows.map(mkCategory).filter((c): c is MkCategory => c !== null) : null;
      } catch { return null; }
    },
  });
  return list ?? [];
}

/** market_browse: one page of the grid. `q` as the page's address gave it, already checked (lib/market/core.ts
 *  MkBrowseQuery). An answer that cannot be read is the empty page. */
export async function mkBrowse(q: MkBrowseQuery = {}): Promise<MkResult<MkBrowse>> {
  const r = await call<unknown>("market_browse", { p: q });
  return r.ok ? { ok: true, data: mkBrowseOf(r.data) } : r;
}
/** market_listing_get: a listing's page, for a visitor (`s` null) or the signed-in account; null when nobody may see it. */
export const mkListingGet = (id: number, s: Session | null) =>
  call<MkListing | null>("market_listing_get", { p_listing: id, p_id: s?.id ?? null, p_token: s?.token ?? null }, { shape: orNull(mkHasId) });
/** market_shop_get: an approved shop's page; null for any other slug. */
export const mkShopGet = (slug: string) => call<MkShop | null>("market_shop_get", { p_slug: slug }, { shape: orNull((v) => obj(v) && typeof v.slug === "string") });
/** market_shops: the approved shops, by name. */
export const mkShops = () => call<{ items: MkShopRow[] }>("market_shops", {}, { shape: hasList("items") });
/** market_index: every listing on sale and every approved shop, for the sitemap and the site's search. */
export const mkIndex = () => call<MkIndex>("market_index", {}, { shape: (v) => obj(v) && Array.isArray(v.listings) && Array.isArray(v.shops), timeout: 8000 });

/* ------------------------------------------------------------------ the account */

/** market_me: what this account may do in the Marketplace and what its forms need. */
export const mkMe = (s: Session, req?: Request) => call<MkMe>("market_me", who(s), { req, shape: (v) => obj(v) && obj(v.limits) && obj(v.seller) });

/* ------------------------------------------------------------------ selling */

/** market_listing_save: a new draft (`id` null) or a change to one of the account's own listings. */
export const mkListingSave = (s: Session, id: number | null, fields: MkListingFields, req?: Request) =>
  call<{ listing: MkListingMine; purge: number }>("market_listing_save", { ...who(s), p_listing: id, p: fields }, { req, shape: (v) => obj(v) && mkHasId(v.listing) });
/** market_photo_slot: the one-use name one photo is stored at ("listing": one of the account's own listings, `ref` its
 *  number; "shop": the account's own shop's logo, `ref` null), good for ten minutes. */
export const mkPhotoSlot = (s: Session, target: "listing" | "shop", ref: number | null, ext: "jpg" | "webp", req?: Request) =>
  call<{ name: string; small: string; expires_at: string }>("market_photo_slot", { ...who(s), p_for: target, p_ref: ref, p_ext: ext }, { req, shape: (v) => obj(v) && isMkPhotoName(v.name) });
/** market_listing_publish: a draft goes on sale at once (or is held for staff to look at: its `status` says which). */
export const mkListingPublish = (s: Session, id: number, nameMode: MkNameMode, consent: boolean, terms: string | null, req?: Request) =>
  call<{ listing: MkListingMine }>("market_listing_publish", { ...who(s), p_listing: id, p_name_mode: nameMode, p_consent: consent, p_terms: terms }, { req, shape: (v) => obj(v) && mkHasId(v.listing) });
/** market_listing_state: reserved, back on sale, sold (with the price it sold for), deleted, or renewed. */
export const mkListingState = (s: Session, id: number, action: MkAction, price: number | null, req?: Request) =>
  call<{ listing: MkListingMine; commission: MkCommission | null; purge: number }>("market_listing_state", { ...who(s), p_listing: id, p_action: action, p_price: price }, { req, shape: (v) => obj(v) && mkHasId(v.listing) });
/** market_my_listings: every listing of the account but the deleted ones, and its limits. */
export const mkMyListings = (s: Session, req?: Request) => call<{ items: MkListingMine[]; limits: MkLimits }>("market_my_listings", who(s), { req, shape: hasList("items") });

/* ------------------------------------------------------------------ shops */

/** market_shop_contact: an approved shop's phone and WhatsApp, for a signed-in account. */
export const mkShopContact = (s: Session, slug: string, req?: Request) => call<MkShopContact>("market_shop_contact", { ...who(s), p_slug: slug }, { req, shape: obj });
/** market_shop_apply: the account's shop application, or a change to its shop. */
export const mkShopApply = (s: Session, fields: MkShopFields, req?: Request) => call<{ shop: MkShopMine }>("market_shop_apply", { ...who(s), p: fields }, { req, shape: (v) => obj(v) && mkHasId(v.shop) });
/** market_shop_mine: the account's own shop or application, or null. */
export const mkShopMine = (s: Session, req?: Request) => call<{ shop: MkShopMine | null }>("market_shop_mine", who(s), { req, shape: obj });

/* ------------------------------------------------------------------ contact */

/** market_thread_open: the first message about a listing (or one more in the buyer's thread on it). */
export const mkThreadOpen = (s: Session, listing: number, body: string, nameMode: MkNameMode, req?: Request) =>
  call<{ thread_id: number; created: boolean }>("market_thread_open", { ...who(s), p_listing: listing, p_body: body, p_name_mode: nameMode }, { req, shape: (v) => obj(v) && typeof v.thread_id === "number" });
/** market_thread_send: one more message in a thread the account is in. */
export const mkThreadSend = (s: Session, thread: number, body: string, req?: Request) =>
  call<{ message: MkMessage }>("market_thread_send", { ...who(s), p_thread: thread, p_body: body }, { req, shape: (v) => obj(v) && mkHasId(v.message) });
/** market_threads: the account's inbox, the newest first. */
export const mkThreads = (s: Session, req?: Request) => call<{ items: MkThreadRow[] }>("market_threads", who(s), { req, shape: hasList("items") });
/** market_thread_get: one thread and its messages (the latest hundred, or those before message `before`); it is marked read. */
export const mkThreadGet = (s: Session, thread: number, before: number | null, req?: Request) =>
  call<MkThreadGet>("market_thread_get", { ...who(s), p_thread: thread, p_before: before }, { req, shape: (v) => obj(v) && mkHasId(v.thread) && Array.isArray(v.messages) });
/** market_share_whatsapp: the account shows its WhatsApp number to the other person in this one thread. */
export const mkShareWhatsapp = (s: Session, thread: number, req?: Request) => call<{ shared: true }>("market_share_whatsapp", { ...who(s), p_thread: thread }, { req, shape: obj });
/** market_unread: how many of the account's threads hold something unread. */
export const mkUnread = (s: Session) => call<{ n: number }>("market_unread", who(s), { shape: (v) => obj(v) && typeof v.n === "number" });
/** market_report: a listing or a thread reported to staff. */
export const mkReport = (s: Session, target: MkReportTarget, ref: number, reason: MkReportReason, note: string | null, req?: Request) =>
  call<{ dup: boolean }>("market_report", { ...who(s), p_target: target, p_ref: ref, p_reason: reason, p_note: note }, { req, shape: obj });
/** market_block: the other person of this thread blocked (or no longer blocked). */
export const mkBlock = (s: Session, thread: number, on: boolean, req?: Request) => call<{ blocked: boolean }>("market_block", { ...who(s), p_thread: thread, p_on: on }, { req, shape: obj });

/* ------------------------------------------------------------------ photos in the marketplace's own bucket */

/** The storage's own secret key (a Worker secret, never a NEXT_PUBLIC_ one): the website is the only writer to the
 *  `market` bucket, so a photo is stored only after the photo route has read its type from its first bytes, refused
 *  GPS, stripped its metadata and paired its two copies. The bucket has no insert policy for the public key. */
const writer = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let key = "";
  try { key = getCloudflareContext().env.SUPABASE_SERVICE_ROLE_KEY ?? ""; } catch { /* not on Cloudflare */ }
  key ||= process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return url && key ? { url, key } : null;
};
const later = (p: Promise<unknown>) => {
  const quiet = p.catch(() => undefined);
  try { getCloudflareContext().ctx.waitUntil(quiet); } catch { /* not on Cloudflare: it runs on */ }
};

/** One file stored in the `market` bucket at a name the database issued (mkPhotoSlot's `name`, or its `small`), with
 *  the storage's secret key (writer above; none set: nothing is stored), never over a file it already holds
 *  (x-upsert false). Only the photo route calls it, after its own checks. `type`: "image/jpeg" or "image/webp".
 *  Answers whether the storage kept it. */
export async function mkStorePut(name: string, bytes: Uint8Array<ArrayBuffer>, type: "image/jpeg" | "image/webp"): Promise<boolean> {
  const st = writer();
  // the photo itself, or its small copy (<name>.w480.<ext>)
  if (!st || !isMkPhotoName(name.replace(".w480.", "."))) return false;
  try {
    const up = await fetch(`${st.url}/storage/v1/object/market/${name}`, {
      method: "POST",
      headers: { apikey: st.key, Authorization: `Bearer ${st.key}`, "content-type": type, "x-upsert": "false", "cache-control": "max-age=31536000" },
      body: bytes, signal: AbortSignal.timeout(15_000),
    });
    return up.ok;
  } catch { return false; }
}

/** The photos the database no longer wants (a seller took one off a listing; a listing deleted 30 days ago or expired
 *  60 days ago) are removed from the storage here, with the storage's secret key (writer above): market_purge_take is
 *  the service key's alone, and the bucket has no remove policy for the public key. Both copies of each go. Answers how
 *  many names were sent for removal; 0 when there was nothing to do, no key is set or the database has no marketplace. */
export async function purgeMarketPhotos(max = 100): Promise<number> {
  const st = writer();
  if (!st) return 0;
  const auth = { apikey: st.key, Authorization: `Bearer ${st.key}`, "content-type": "application/json" };
  try {
    const take = await fetch(`${st.url}/rest/v1/rpc/market_purge_take`, {
      method: "POST", headers: auth, body: JSON.stringify({ p_max: max }), signal: AbortSignal.timeout(8000),
    });
    if (!take.ok) return 0;
    const data: unknown = await take.json();
    if (!hasList("names")(data)) return 0;
    const names = ((data as { names: unknown[] }).names).filter((n): n is string => typeof n === "string" && isMkPhotoName(n));
    if (!names.length) return 0;
    const res = await fetch(`${st.url}/storage/v1/object/market`, {
      method: "DELETE", headers: auth,
      body: JSON.stringify({ prefixes: names.flatMap((n) => [n, mkSmallName(n)]) }), signal: AbortSignal.timeout(15_000),
    });
    return res.ok ? names.length : 0;
  } catch { return 0; }
}
/** The same, behind the answer: a route calls it after a save or a state change that answered `purge` above 0. */
export const purgeLater = (max = 100): void => later(purgeMarketPhotos(max));
