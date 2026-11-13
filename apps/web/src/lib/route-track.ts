import type { SiteContent } from "./site";
import type { RouteItem, TicketSession } from "./tickets";

// The route's own page (the booking app's route-page.js, new features F11, 2026-11-13): a ride tied to a route
// (sessions.route_slug, the Routes page's list) opens it from its ticket - the route's name, its line drawn from the
// stored points (north up, no base map), the distance, the surface, the level and the turn points in order, with a GPX
// file the rider can save for a bike computer. The GPX is written in the browser from the stored route; nothing outside
// the site is called, and no elevation is read or drawn (the owner dropped it on 2026-11-13; the Routes page's own GPX
// profile is a separate thing).
// The stored route is site_content 'route.track.<key>' = {v:1, pts:[[lat,lng]...], turns:[{km,en,ar}]}, public to read
// and written by admins from the booking app's staff screens (never here): loadSiteContent() already holds it.
// Only types come from ./tickets, so the ticket's client part (TicketRoutePage) carries nothing more than this file.

export const ROUTE_TRACK_KEY = "route.track.";
export const ROUTE_MAX_TURNS = 30;
const MAX_KEY = 80;

/** The key a route's line is stored under (the booking app's _rtpKey, copied exactly): letters and digits as they are,
 *  every other character written _<its code in hex>_ ('obhur-coast' is route.track.obhur_2d_coast); a slug too long
 *  for the table's 80 characters goes under two short sums of itself (h.<fnv-1a><djb2>). */
export function routeTrackKey(slug: string): string {
  const s = String(slug), k = ROUTE_TRACK_KEY + s.replace(/[^a-zA-Z0-9]/g, (c) => `_${c.charCodeAt(0).toString(16)}_`);
  if (k.length <= MAX_KEY) return k;
  let a = 0x811c9dc5, b = 5381;
  for (let i = 0; i < s.length; i++) {
    a = Math.imul(a ^ s.charCodeAt(i), 0x01000193) >>> 0;
    b = (Math.imul(b, 33) + s.charCodeAt(i)) >>> 0;
  }
  return `${ROUTE_TRACK_KEY}h.${a.toString(16)}${b.toString(16)}`;
}

export type RoutePoint = [number, number];
export type RouteTurn = { km: number; en: string; ar: string };
export type RouteTrack = { pts: RoutePoint[]; turns: RouteTurn[] };

// a value read as the booking app's isFinite reads it (a number, or a text of one)
const fin = (v: unknown) => Number.isFinite(Number(v));
const okPt = (p: unknown): p is [unknown, unknown] =>
  Array.isArray(p) && fin(p[0]) && fin(p[1]) && Math.abs(Number(p[0])) <= 90 && Math.abs(Number(p[1])) <= 180;
const name60 = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

/** What is stored, read as stored (_rtpClean): anything that is not a point or a named distance is left out; the turn
 *  points in order along the route. Null when there is neither a line nor a turn point. */
export function cleanTrack(v: unknown): RouteTrack | null {
  if (!v || typeof v !== "object") return null;
  const o = v as { pts?: unknown; turns?: unknown };
  const pts = (Array.isArray(o.pts) ? o.pts : []).filter(okPt).slice(0, 2000).map((p): RoutePoint => [Number(p[0]), Number(p[1])]);
  const turns = (Array.isArray(o.turns) ? o.turns : [])
    .map((x) => { const t = (x && typeof x === "object" ? x : {}) as { km?: unknown; en?: unknown; ar?: unknown }; return { km: Number(x ? t.km : x), en: name60(t.en), ar: name60(t.ar) }; })
    .filter((x) => Number.isFinite(x.km) && x.km >= 0 && (x.en || x.ar)).sort((a, b) => a.km - b.km).slice(0, ROUTE_MAX_TURNS);
  return pts.length > 1 || turns.length ? { pts: pts.length > 1 ? pts : [], turns } : null;
}

/** The stored route of a slug in the site's content, or null when none is stored (or it holds nothing). */
export function routeTrackOf(content: SiteContent | null, slug: string): RouteTrack | null {
  const key = routeTrackKey(slug);
  return content && Object.prototype.hasOwnProperty.call(content, key) ? cleanTrack(content[key]) : null;
}

// ── The line's arithmetic (the booking app's _rtpDist, _rtpCum, _rtpLenKm, _rtpAt) ──────────────────────────────────
/** Metres between two [lat, lng] (haversine). */
export function routeDist(a: RoutePoint, b: RoutePoint): number {
  const p = Math.PI / 180, dla = (b[0] - a[0]) * p, dlo = (b[1] - a[1]) * p;
  const h = Math.sin(dla / 2) ** 2 + Math.cos(a[0] * p) * Math.cos(b[0] * p) * Math.sin(dlo / 2) ** 2;
  return 12742017.6 * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** The metres from the start at each point. */
export function routeCum(pts: RoutePoint[]): number[] {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + routeDist(pts[i - 1], pts[i]));
  return c;
}
/** The line's length in km. */
export const lineKm = (pts: RoutePoint[]) => (pts.length > 1 ? routeCum(pts)[pts.length - 1] / 1000 : 0);
/** The point m metres along the line. */
export function pointAt(pts: RoutePoint[], cum: number[], m: number): RoutePoint | null {
  if (!pts.length) return null;
  if (!(m > 0)) return pts[0];
  if (m >= cum[cum.length - 1]) return pts[pts.length - 1];
  let i = 1;
  while (i < cum.length - 1 && cum[i] < m) i++;
  const f = (m - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
}

/** The line on a flat sheet, north up whatever the page's direction (a map does not turn round for Arabic), as the
 *  booking app's _rtpSvg draws it: 320 wide, 120 to 300 high; the path, the start (a filled dot) and each turn point
 *  (by its km) where it falls on the line. Null for a route with no line. */
export type RouteDrawing = { w: number; h: number; d: string; start: [number, number]; marks: [number, number][] };
export function routeDrawing(pts: RoutePoint[], turnKms: number[]): RouteDrawing | null {
  if (pts.length < 2) return null;
  const la = pts.map((p) => p[0]), lo = pts.map((p) => p[1]), k = Math.cos(((Math.min(...la) + Math.max(...la)) / 2) * Math.PI / 180);
  const x0 = Math.min(...lo) * k, y0 = Math.max(...la), dx = (Math.max(...lo) * k - x0) || 1e-9, dy = (y0 - Math.min(...la)) || 1e-9;
  const W = 320, pad = 18, H = Math.round(Math.max(120, Math.min(300, (W - 2 * pad) * dy / dx + 2 * pad)));
  const sc = Math.min((W - 2 * pad) / dx, (H - 2 * pad) / dy), ox = (W - dx * sc) / 2, oy = (H - dy * sc) / 2;
  const xy = (p: RoutePoint): [number, number] => [Math.round((ox + (p[1] * k - x0) * sc) * 10) / 10, Math.round((oy + (y0 - p[0]) * sc) * 10) / 10];
  const cum = routeCum(pts);
  return {
    w: W, h: H, d: `M${pts.map((p) => xy(p).join(" ")).join("L")}`, start: xy(pts[0]),
    marks: turnKms.map((km) => xy(pointAt(pts, cum, km * 1000) as RoutePoint)),
  };
}

/** A turn point's name in the page's language: Arabic reads the Arabic name, every other language the English one,
 *  each falling back to the other (_rtpTurnName). */
export const turnName = (x: { en: string; ar: string }, locale: string) => (locale === "ar" ? x.ar || x.en : x.en || x.ar);

// ── The GPX file (GPX 1.1): the line as one track, the turn points as waypoints set on the line (_rtpGpx) ────────────
const xmlText = (s: unknown) =>
  String(s ?? "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string);
export function routeGpx(name: string, pts: RoutePoint[], turns: { km: number; name: string }[]): string {
  const f = (n: number) => (Math.round(n * 1e5) / 1e5).toFixed(5), cum = routeCum(pts), nm = xmlText(name);
  const wpt = pts.length ? turns.map((x, i) => {
    const p = pointAt(pts, cum, x.km * 1000) as RoutePoint;
    return `<wpt lat="${f(p[0])}" lon="${f(p[1])}"><name>${xmlText(`${i + 1}. ${x.name}`)}</name></wpt>`;
  }) : [];
  return ['<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="MicroMobility" xmlns="http://www.topografix.com/GPX/1/1">',
    `<metadata><name>${nm}</name></metadata>`, ...wpt,
    `<trk><name>${nm}</name><trkseg>`, ...pts.map((p) => `<trkpt lat="${f(p[0])}" lon="${f(p[1])}"/>`), "</trkseg></trk>", "</gpx>", ""].join("\n");
}
/** The saved file's name: the slug, as the booking app names it. */
export const gpxFileName = (slug: string) => `${String(slug).replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "route"}.gpx`;

/** What the ticket's route page shows: the route as the Routes page names it (its name, the distance - the Routes item's,
 *  else the line's own - the level, the surface, the map link) with its stored line and turn points, the names in the
 *  page's language. Null when the ride follows no route, the Routes page no longer lists it, or nothing is stored for
 *  it: then the ticket shows no Route details (the route itself is already on the ticket). */
export type RoutePage = {
  slug: string; name: string; km: number; level: string; surface: string; href: string | null;
  pts: RoutePoint[]; turns: { km: number; name: string }[];
};
export function routePageOf(s: Pick<TicketSession, "routeSlug"> | undefined, routes: Map<string, RouteItem>, content: SiteContent | null, locale: string): RoutePage | null {
  const slug = s?.routeSlug;
  const r = slug ? routes.get(slug) : undefined;
  const tr = slug && r ? routeTrackOf(content, slug) : null;
  if (!slug || !r || !tr) return null;
  return {
    slug, name: r.name, km: r.km > 0 ? r.km : lineKm(tr.pts), level: r.level.trim(), surface: r.surface.trim(),
    href: /^https:\/\//i.test(r.href) ? r.href : null, // the ticket's own map link (ticketRoute)
    pts: tr.pts, turns: tr.turns.map((x) => ({ km: x.km, name: turnName(x, locale) })),
  };
}
