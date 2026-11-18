import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ACCOUNT_COOKIE, decodeSession, sameOrigin, type Session } from "./account-core";
import { forVisitor, rpcServer } from "./account";
import { jsonCapped, TOO_BIG } from "./capped-body";
import { emAbsent } from "./emergency";
import { cookieValue } from "./live";
import { edgeScope, memo } from "./memo";
import { withinLimit } from "./rate-limit";
import { TM_EMPTY, TM_PAGE, tmMine, tmPhotoBytes, tmPublic, tmRefusal, type TmAbout, type TmCard, type TmPublicList } from "./testimonials";

// Testimonials on the server (lib/testimonials.ts has the logic): the public reads, kept a minute as the site's other
// reads are (lib/memo.ts), and the rider's routes, which send the account cookie's id and token to the database - the
// session never reaches the browser. A database without the functions yet (PGRST202: the migration is not applied)
// reads as "none published", never as an error page.

/** How long a public read is kept in this Worker: a staff publish shows within a minute, as a staff edit does. */
const TTL_MS = 60_000;

/** testimonials_public, one page of it (`about`: one kind only; `offset`: how many to skip), kept a minute. The empty
 *  list when the database has no such function or does not answer. */
export async function readTestimonials(about: TmAbout | null, offset: number): Promise<TmPublicList> {
  const off = Math.max(0, Math.min(offset, 100_000));
  const key = `tm:public:${edgeScope()}:${about ?? "all"}:${off}`;
  const list = await memo<TmPublicList>(key, {
    ttl: TTL_MS,
    read: async () => {
      const r = await rpcServer<unknown>("testimonials_public", { p_about: about, p_featured: false, p_limit: TM_PAGE, p_offset: off });
      if (r.status === 200) return tmPublic(r.data);
      return r.status >= 400 && r.status < 500 ? TM_EMPTY : null; // no answer: the copy held, else nothing
    },
  });
  return list ?? TM_EMPTY;
}

/** The featured ones (12 at most), for Home's "What riders say": read only while the switch is on, kept a minute. */
export async function readFeatured(): Promise<TmCard[]> {
  const list = await memo<TmPublicList>(`tm:featured:${edgeScope()}`, {
    ttl: TTL_MS,
    read: async () => {
      const r = await rpcServer<unknown>("testimonials_public", { p_featured: true });
      if (r.status === 200) return tmPublic(r.data);
      return r.status >= 400 && r.status < 500 ? TM_EMPTY : null;
    },
  });
  return (list ?? TM_EMPTY).items;
}

/* ------------------------------------------------------------------ the rider's routes */

export const tmJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store, private" } });

export const tmSessionOf = (req: Request): Session | null => decodeSession(cookieValue(req.headers.get("cookie"), ACCOUNT_COOKIE));

/** GET /api/testimonials/mine: testimonial_mine for the signed-in account, as lib/testimonials.ts tmMine reads it,
 *  {ok: true, on, names, since, items}; or {ok: false, error}: "signin" (no cookie, or a session the database refused),
 *  "busy", "absent" (no such function yet), "generic" (no answer). */
export async function tmMineGet(req: Request): Promise<Response> {
  const s = tmSessionOf(req);
  if (!s) return tmJson({ ok: false, error: "signin" }, 401);
  if (!(await withinLimit(req, "account-check", undefined, s.id))) return tmJson({ ok: false, error: "busy" }, 429);
  const r = await rpcServer<unknown>("testimonial_mine", { p_id: s.id, p_token: s.token });
  if (r.status === 0 || r.status >= 500) return tmJson({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return tmJson({ ok: false, error: emAbsent(r) ? "absent" : "generic" }, emAbsent(r) ? 404 : 502);
  const mine = tmMine(r.data);
  if (mine) return tmJson({ ok: true, ...mine });
  const e = tmRefusal(r.data) ?? "generic";
  return tmJson({ ok: false, error: e }, e === "signin" ? 401 : 502);
}

type Call = { fn: string; max: number; timeout?: number; args: (body: unknown) => Record<string, unknown> | null };

/** POST /api/testimonials/send and /delete: one of the account's own actions, sent to its function with the cookie's
 *  id and token. Only this site's pages may call it, signed in, `max` bytes of body at most. Answers the function's own
 *  {ok: true, ...}, or {ok: false, error}: its own code (lib/testimonials.ts TM_ERRORS), or the site's - "origin",
 *  "signin" (no cookie), "busy" (the minute's requests), "invalid" (a body that is not the action's), "absent" (no such
 *  function yet), "generic" (no answer). */
export async function tmPost(req: Request, call: Call): Promise<Response> {
  if (!sameOrigin(req.headers.get("origin"), req.url)) return tmJson({ ok: false, error: "origin" }, 403);
  const s = tmSessionOf(req);
  if (!s) return tmJson({ ok: false, error: "signin" }, 401);
  if (Number(req.headers.get("content-length") || 0) > call.max) return tmJson({ ok: false, error: "invalid" }, 413);
  if (!(await withinLimit(req, "account-check", undefined, s.id))) return tmJson({ ok: false, error: "busy" }, 429);
  const body = await jsonCapped(req, call.max);
  if (body === TOO_BIG) return tmJson({ ok: false, error: "invalid" }, 413);
  const args = call.args(body);
  if (!args) return tmJson({ ok: false, error: "invalid" }, 400);
  const r = await rpcServer<unknown>(call.fn, forVisitor(req, { p_id: s.id, p_token: s.token, ...args }), call.timeout);
  if (r.status === 0 || r.status >= 500) return tmJson({ ok: false, error: "generic" }, 502);
  if (r.status >= 400) return tmJson({ ok: false, error: emAbsent(r) ? "absent" : "generic" }, emAbsent(r) ? 404 : 502);
  const d = r.data && typeof r.data === "object" && !Array.isArray(r.data) ? (r.data as Record<string, unknown>) : null;
  if (d?.ok === true) return tmJson(d);
  const e = tmRefusal(d) ?? "generic";
  return tmJson({ ok: false, error: e }, e === "signin" ? 401 : e === "generic" ? 502 : 409);
}

/* ------------------------------------------------------------------ the photo */

/** What a browser is told about a photo: an hour, then the copy it has while it asks again (another hour at most): a
 *  photo staff take off, or one its rider deletes, must stop being served (PDPL), so no copy lives for long. */
export const TM_PHOTO_CACHE = "public, max-age=3600, stale-while-revalidate=3600";
/** How long the edge keeps a photo read from the database: an hour, so one staff reject or hide (or the rider's delete) stops being served within the hour. */
const PHOTO_EDGE_S = 3_600;
type EdgeCache = { match(k: string): Promise<Response | undefined>; put(k: string, r: Response): Promise<void> };
const edgeCache = (): EdgeCache | null => {
  try { return ((globalThis as { caches?: { default?: EdgeCache } }).caches?.default) ?? null; } catch { return null; }
};
const later = (p: Promise<unknown>) => {
  const quiet = p.catch(() => undefined);
  try { getCloudflareContext().ctx.waitUntil(quiet); } catch { /* not on Cloudflare: it runs on */ }
};

const notFound = (maxAge = 60) => new Response("Not found", { status: 404, headers: { "cache-control": `public, max-age=${maxAge}` } });

/** GET /api/testimonials/photo/<id>: a PUBLISHED testimonial's photo (testimonial_photo), as the picture itself with its
 *  own type, kept at the edge for an hour (Cloudflare's cache, the key scoped to the database as the site's other edge
 *  copies are) so the database is read once per photo per place and hour, not once per visitor. 404 for anything else -
 *  an id that is not a number, a testimonial not published or with no photo, a database without the function - and
 *  504, kept nowhere, when the database did not answer. */
export async function tmPhotoGet(id: string): Promise<Response> {
  if (!/^\d{1,15}$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) return notFound(3600);
  const cache = edgeCache();
  const key = `https://micromobility.sa/__tm-photo/${edgeScope()}/${Number(id)}`;
  try {
    const hit = await cache?.match(key);
    if (hit) return serve(hit.body, hit.headers.get("content-type") || "image/jpeg");
  } catch { /* the edge's copy is a convenience */ }
  const r = await rpcServer<unknown>("testimonial_photo", { p_tid: Number(id) }, 8000);
  if (r.status === 0 || r.status >= 500) return new Response("The photo could not be fetched", { status: 504, headers: { "cache-control": "no-store" } });
  const p = r.status === 200 ? tmPhotoBytes(r.data) : null;
  if (!p) return notFound();
  if (cache) later(cache.put(key, new Response(p.bytes.slice(), { headers: { "content-type": p.type, "cache-control": `public, max-age=${PHOTO_EDGE_S}` } })));
  return serve(p.bytes, p.type);
}

function serve(body: BodyInit | null, type: string): Response {
  return new Response(body, {
    headers: { "content-type": type, "content-disposition": "inline", "cache-control": TM_PHOTO_CACHE, "x-content-type-options": "nosniff" },
  });
}
