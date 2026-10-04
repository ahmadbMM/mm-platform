import { getCloudflareContext } from "@opennextjs/cloudflare";
import { memo } from "./memo";
import { SITE_URL } from "./seo";

// A route's GPX file (content/pages/routes.ts, each route's gpxHref), read on the server and drawn
// as an elevation profile on the Routes page: the track's points, its length and its climb, from
// the file itself, so a route staff have not measured still shows a distance and a climb. Plain
// text parsing - the Worker has no DOM - of the <trkpt> (or <rtept>) points and their <ele>.

export type GpxPoint = { lat: number; lng: number; ele: number | null };
export type GpxTrack = {
  points: GpxPoint[];
  /** The track's length in km, from point to point (haversine). */
  distanceKm: number;
  /** The metres climbed: every rise, after light smoothing so GPS jitter does not count. */
  climbM: number;
  /** Whether the points carry an elevation at all. */
  hasElevation: boolean;
};

const MAX_BYTES = 3 * 1024 * 1024;
const MAX_POINTS = 20_000;
const POINT = /<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1\s*>)/g;
const ATTR = (attrs: string, name: string) => {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']\\s*(-?\\d+(?:\\.\\d+)?)\\s*["']`).exec(attrs);
  return m ? Number(m[1]) : NaN;
};

/** The points of a GPX file, or null when it holds no track. */
export function parseGpx(xml: string): GpxTrack | null {
  if (typeof xml !== "string" || !/<gpx\b/i.test(xml)) return null;
  const points: GpxPoint[] = [];
  for (const m of xml.matchAll(POINT)) {
    const lat = ATTR(m[2], "lat"), lng = ATTR(m[2], "lon");
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const e = m[3] ? /<ele>\s*(-?\d+(?:\.\d+)?)\s*<\/ele>/.exec(m[3]) : null;
    points.push({ lat, lng, ele: e ? Number(e[1]) : null });
    if (points.length >= MAX_POINTS) break;
  }
  if (points.length < 2) return null;
  const hasElevation = points.filter((p) => p.ele !== null).length >= 2;
  return { points, distanceKm: Math.round(trackLength(points) * 100) / 100, climbM: hasElevation ? Math.round(climb(points)) : 0, hasElevation };
}

const R = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;
/** Kilometres between two points on the globe. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function trackLength(points: GpxPoint[]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i]);
  return km;
}

/** Elevations with the gaps filled from their neighbours and a five-point moving average over them. */
function smoothed(points: GpxPoint[]): number[] {
  const raw = points.map((p) => p.ele);
  let last = raw.find((e): e is number => e !== null) ?? 0;
  const filled = raw.map((e) => (e === null ? last : (last = e)));
  return filled.map((_, i) => {
    const from = Math.max(0, i - 2), to = Math.min(filled.length - 1, i + 2);
    let sum = 0;
    for (let j = from; j <= to; j++) sum += filled[j];
    return sum / (to - from + 1);
  });
}

function climb(points: GpxPoint[]): number {
  const e = smoothed(points);
  let up = 0;
  for (let i = 1; i < e.length; i++) if (e[i] > e[i - 1]) up += e[i] - e[i - 1];
  return up;
}

/** The track's elevation at `samples` equal steps of distance, for the profile. Null without elevation. */
export function elevationProfile(track: GpxTrack, samples = 120): number[] | null {
  if (!track.hasElevation || track.points.length < 2 || samples < 2) return null;
  const e = smoothed(track.points);
  const dist: number[] = [0];
  for (let i = 1; i < track.points.length; i++) dist.push(dist[i - 1] + haversineKm(track.points[i - 1], track.points[i]));
  const total = dist[dist.length - 1];
  if (total <= 0) return null;
  const out: number[] = [];
  let j = 0;
  for (let s = 0; s < samples; s++) {
    const d = (total * s) / (samples - 1);
    while (j < dist.length - 2 && dist[j + 1] < d) j++;
    const span = dist[j + 1] - dist[j];
    const t = span > 0 ? Math.min(1, Math.max(0, (d - dist[j]) / span)) : 0;
    out.push(e[j] + (e[j + 1] - e[j]) * t);
  }
  return out;
}

/** The profile as two SVG paths in a w x h box: the line, and the area under it. A track that
 *  barely climbs is drawn against at least a 20 m range, so noise never looks like mountains. */
export function profilePaths(profile: number[], w = 320, h = 80): { line: string; area: string; min: number; max: number } {
  const lo = Math.min(...profile), hi = Math.max(...profile);
  const span = Math.max(20, hi - lo);
  const mid = (lo + hi) / 2, top = mid + span / 2, pad = 4;
  const x = (i: number) => Math.round(((w * i) / (profile.length - 1)) * 10) / 10;
  const y = (v: number) => Math.round((pad + ((top - v) / span) * (h - pad * 2)) * 10) / 10;
  const line = profile.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join("");
  return { line, area: `${line}L${w} ${h}L0 ${h}Z`, min: Math.round(lo), max: Math.round(hi) };
}

/** Only an https address, or one of this site's own paths, is fetched. A file staff uploaded
 *  (/media/...) is read from the storage itself, not through this site's address: a Worker asking
 *  its own zone is sent to the origin (the old host), never to itself. */
export function gpxUrl(href: string): string | null {
  if (/^https:\/\//i.test(href)) return href;
  const media = /^\/media\/([a-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)+)$/.exec(href);
  if (media && !media[1].includes("..")) {
    const store = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return store ? `${store}/storage/v1/object/public/site/${media[1]}` : null;
  }
  if (/^\/(?!\/)/.test(href) && !href.startsWith("/media/")) return `${SITE_URL}${href}`;
  return null;
}

/** The site's own files (public/, e.g. /site/...) through the Worker's assets, for the same reason;
 *  null off Cloudflare (tests, `next start`), where the address is fetched as it is. */
function assetFetch(href: string): typeof fetch | null {
  if (!/^\/(?!\/|media\/)/.test(href)) return null;
  try {
    const assets = (getCloudflareContext().env as { ASSETS?: { fetch: typeof fetch } }).ASSETS;
    return assets ? ((input, init) => assets.fetch(input, init)) as typeof fetch : null;
  } catch {
    return null;
  }
}

async function readGpx(href: string, fetchImpl: typeof fetch): Promise<GpxTrack | null> {
  const url = gpxUrl(href);
  if (!url) return null;
  try {
    const res = await (assetFetch(href) ?? fetchImpl)(url, { signal: AbortSignal.timeout(4000), headers: { Accept: "application/gpx+xml, application/xml, text/xml, */*" } });
    if (!res.ok) return null;
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BYTES) return null;
    const text = await res.text();
    if (text.length > MAX_BYTES) return null;
    return parseGpx(text);
  } catch {
    return null;
  }
}

/** The track behind a route's GPX link, kept for an hour per Worker instance; null when it cannot
 *  be read, is too big (3 MB), or holds no track. */
export async function loadGpx(href: string, fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<GpxTrack | null> {
  if (!href) return null;
  return memo<GpxTrack>(`gpx:${href}`, { ttl: 60 * 60_000, now, read: () => readGpx(href, fetchImpl) });
}
