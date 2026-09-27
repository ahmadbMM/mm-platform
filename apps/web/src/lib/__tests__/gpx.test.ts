import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { elevationProfile, gpxUrl, haversineKm, loadGpx, parseGpx, profilePaths } from "../gpx";
import { resetMemo } from "../memo";
import { routeNames, routeNameOf } from "../route-names";

// The Routes page reads a route's GPX file on the server: its points, its length and its climb,
// and the elevation profile it draws from them. Nothing here trusts the file.

// Tracks north along a meridian: each 0.01° of latitude is about 1.11 km.
const gpx = (pts: string) => `<?xml version="1.0"?><gpx version="1.1" creator="test"><trk><name>T</name><trkseg>${pts}</trkseg></trk></gpx>`;
const pt = (lat: number, lon: number, ele?: number) => `<trkpt lat="${lat}" lon="${lon}">${ele === undefined ? "" : `<ele>${ele}</ele>`}<time>2026-09-27T05:00:00Z</time></trkpt>`;
// A hill: 21 points half a kilometre apart, 10 m up to 110 m over the first ten, down to 60 m over the last.
const HILL = gpx(Array.from({ length: 21 }, (_, i) => pt(21.5 + i * 0.005, 39.1, i <= 10 ? 10 + i * 10 : 110 - (i - 10) * 5)).join(""));

describe("parseGpx", () => {
  it("reads the track's points, its length and its climb", () => {
    const t = parseGpx(HILL)!;
    expect(t.points).toHaveLength(21);
    expect(t.hasElevation).toBe(true);
    expect(t.distanceKm).toBeGreaterThan(11);
    expect(t.distanceKm).toBeLessThan(11.3);
    // lightly smoothed (five points), so the climb is the hill's rise, not every wobble of the GPS
    expect(t.climbM).toBeGreaterThan(80);
    expect(t.climbM).toBeLessThanOrEqual(100);
    // a wobble of a metre or two along a flat road counts for almost nothing
    const flat = parseGpx(gpx(Array.from({ length: 41 }, (_, i) => pt(21.5 + i * 0.001, 39.1, 20 + (i % 2))).join("")))!;
    expect(flat.climbM).toBeLessThan(5);
  });
  it("takes route points, self-closing points and points without elevation", () => {
    const t = parseGpx(`<gpx><rte><rtept lat="21.5" lon="39.1"/><rtept lat='21.51' lon='39.1'></rtept></rte></gpx>`)!;
    expect(t.points.map((p) => p.ele)).toEqual([null, null]);
    expect(t.hasElevation).toBe(false);
    expect(t.climbM).toBe(0);
    expect(t.distanceKm).toBeCloseTo(1.11, 1);
  });
  it("answers null for anything that is not a track", () => {
    for (const v of ["", "<html></html>", "<gpx></gpx>", gpx(pt(21.5, 39.1)), gpx(pt(95, 39.1) + pt(96, 39.1))]) expect(parseGpx(v)).toBeNull();
    expect(parseGpx(gpx(pt(21.5, 39.1) + `<trkpt lat="x" lon="y"/>` + pt(21.51, 39.1)))!.points).toHaveLength(2);
  });
});

describe("haversineKm", () => {
  it("measures the globe", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.19, 1);
    expect(haversineKm({ lat: 21.5, lng: 39.1 }, { lat: 21.5, lng: 39.1 })).toBe(0);
  });
});

describe("the elevation profile", () => {
  const t = parseGpx(HILL)!;
  it("samples the track at equal distances, first to last: up the hill, then down", () => {
    const p = elevationProfile(t, 11)!;
    expect(p).toHaveLength(11);
    expect(p[0]).toBeLessThan(30);
    expect(p[5]).toBeGreaterThan(95);
    expect(p[10]).toBeLessThan(p[5]);
    expect(p[10]).toBeGreaterThan(p[0]);
    expect(elevationProfile(t, 1)).toBeNull();
  });
  it("is null without elevation, and its paths fit the box", () => {
    expect(elevationProfile(parseGpx(gpx(pt(21.5, 39.1) + pt(21.51, 39.1)))!)).toBeNull();
    const { line, area, min, max } = profilePaths([10, 30, 20], 300, 60);
    expect(line).toMatch(/^M0 [\d.]+L150 [\d.]+L300 [\d.]+$/);
    expect(area.endsWith("L300 60L0 60Z")).toBe(true);
    expect([min, max]).toEqual([10, 30]);
    // a flat track is drawn against at least a 20 m range, never as a wall
    const flat = profilePaths([100, 101, 100], 300, 60);
    const ys = [...flat.line.matchAll(/ ([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(4);
  });
});

describe("loadGpx", () => {
  beforeEach(() => resetMemo("gpx:"));
  afterEach(() => vi.unstubAllGlobals());
  const ok = (body: string, headers: Record<string, string> = {}) => vi.fn(async (url: string) => new Response(body, { status: 200, headers: { ...headers, "x-asked": url } }));
  it("fetches an https file, or one of the site's own, and keeps it for an hour", async () => {
    const f = ok(gpx(pt(21.5, 39.1, 5) + pt(21.51, 39.1, 8)));
    const a = await loadGpx("/media/routes/corniche.gpx", f as unknown as typeof fetch, 1000);
    expect(a?.points).toHaveLength(2);
    expect(f.mock.calls[0][0]).toBe("https://micromobility.sa/media/routes/corniche.gpx");
    expect(await loadGpx("/media/routes/corniche.gpx", f as unknown as typeof fetch, 30 * 60_000)).toBe(a);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("refuses other addresses, a huge file and a broken one", async () => {
    const f = ok("<gpx/>");
    expect(await loadGpx("http://example.com/a.gpx", f as unknown as typeof fetch)).toBeNull();
    expect(await loadGpx("ftp://example.com/a.gpx", f as unknown as typeof fetch)).toBeNull();
    expect(f).not.toHaveBeenCalled();
    expect(gpxUrl("//evil.example/a.gpx")).toBeNull();
    const big = ok("<gpx/>", { "content-length": String(10 * 1024 * 1024) });
    expect(await loadGpx("https://example.com/big.gpx", big as unknown as typeof fetch)).toBeNull();
    const down = vi.fn(async () => { throw new Error("offline"); });
    expect(await loadGpx("https://example.com/down.gpx", down as unknown as typeof fetch)).toBeNull();
  });
});

describe("routeNames", () => {
  it("names the site's routes by their slug, in the page's language, and a ride by its route", () => {
    const en = routeNames(null, "en"), ar = routeNames(null, "ar");
    expect(en.get("jeddah-corniche-circuit")).toBe("Jeddah Corniche Circuit");
    expect(en.get("obhur-coast")).toBe("Obhur coast");
    expect(ar.get("obhur-coast")).toBe("ساحل أبحر");
    expect(routeNameOf(en, "asfan-desert-gravel")).toBe("Asfan desert gravel");
    expect(routeNameOf(en, "no-such-route")).toBeNull();
    expect(routeNameOf(en, null)).toBeNull();
    // a list staff saved without slugs names nothing; one with a slug names that route
    const saved = { "routes.routes.items": [{ name: { en: "Loop", ar: "حلقة" } }, { slug: { en: "loop-2", ar: "" }, name: { en: "Loop 2", ar: "حلقة 2" } }] };
    expect([...routeNames(saved, "en").entries()]).toEqual([["loop-2", "Loop 2"]]);
  });
});
