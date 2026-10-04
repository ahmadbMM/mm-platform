"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalize } from "@/i18n/TxProvider";
import { intlOf } from "@/i18n/locales";
import type { LiveAnswer, LivePosition } from "@/lib/live";
import { T } from "./LiveMap.text";

// The live ride map: where the ride leader (and the sweeper) is, from /api/live every ten seconds,
// drawn with MapLibre GL on OpenStreetMap's raster tiles - no Google Maps key. The library comes
// from jsDelivr at a pinned version (next.config.ts allows it); a tile is ordinary image traffic.
const MAPLIBRE = "https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl";
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const EVERY_MS = 10_000;
const COLOUR: Record<LivePosition["role"], string> = { leader: "#077a4b", sweeper: "#c2410c" };

type Marker = { setLngLat(p: [number, number]): Marker; addTo(m: MapApi): Marker; remove(): void; setPopup(p: Popup): Marker };
type Popup = { setText(t: string): Popup };
type MapApi = {
  on(ev: string, fn: () => void): void; remove(): void; fitBounds(b: [[number, number], [number, number]], o: Record<string, unknown>): void;
  easeTo(o: Record<string, unknown>): void; addControl(c: unknown, pos?: string): void; getZoom(): number;
};
type MapLibre = {
  Map: new (o: Record<string, unknown>) => MapApi;
  Marker: new (o: Record<string, unknown>) => Marker;
  Popup: new (o: Record<string, unknown>) => Popup;
  NavigationControl: new (o: Record<string, unknown>) => unknown;
};
declare global { interface Window { maplibregl?: MapLibre } }

let loading: Promise<MapLibre> | null = null;
function loadMapLibre(): Promise<MapLibre> {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  loading ??= new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${MAPLIBRE}.css"]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = `${MAPLIBRE}.css`;
      document.head.appendChild(css);
    }
    const s = document.createElement("script");
    s.src = `${MAPLIBRE}.js`;
    s.async = true;
    s.onload = () => (window.maplibregl ? resolve(window.maplibregl) : reject(new Error("maplibre")));
    s.onerror = () => { loading = null; reject(new Error("maplibre")); };
    document.head.appendChild(s);
  });
  return loading;
}

type Props = { sessionId: string; locale: string };

export default function LiveMap({ sessionId, locale }: Props) {
  const t = useLocalize(T);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapApi | null>(null);
  const markers = useRef(new Map<LivePosition["role"], Marker>());
  const framed = useRef(false);
  const [answer, setAnswer] = useState<LiveAnswer | null>(null);
  const [mapState, setMapState] = useState<"loading" | "ready" | "failed">("loading");
  const [recenter, setRecenter] = useState(0);
  const centred = useRef(0); // the last Recenter tap the view has followed
  const positions = useMemo(() => (answer?.ok ? answer.positions : []), [answer]);
  // The map's box stays once a position has come: a failed ask (no positions for a moment) must not
  // take away the element the map is drawn in - a new, empty one would never get the map back.
  const [shown, setShown] = useState(false);
  if (positions.length > 0 && !shown) setShown(true);

  // Ask every ten seconds while the page is open; a hidden tab waits for its return.
  useEffect(() => {
    let live = true, timer: ReturnType<typeof setTimeout> | null = null;
    const ask = async () => {
      try {
        const r = await fetch(`/api/live?session=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const b = (await r.json().catch(() => null)) as LiveAnswer | null;
        if (live) setAnswer(b && typeof b.ok === "boolean" ? b : { ok: false, error: "network" });
      } catch {
        if (live) setAnswer({ ok: false, error: "network" });
      }
      if (live) timer = setTimeout(() => (document.hidden ? waitForReturn() : ask()), EVERY_MS);
    };
    const waitForReturn = () => document.addEventListener("visibilitychange", () => { if (live && !document.hidden) ask(); }, { once: true });
    ask();
    return () => { live = false; if (timer) clearTimeout(timer); };
  }, [sessionId]);

  // The map itself, once the library is here and there is somewhere to centre it.
  const first = positions[0];
  useEffect(() => {
    if (!first || map.current || !box.current) return;
    let gone = false;
    loadMapLibre().then((gl) => {
      if (gone || !box.current || map.current) return;
      const m = new gl.Map({
        container: box.current,
        style: {
          version: 8,
          sources: { osm: { type: "raster", tiles: [TILES], tileSize: 256, maxzoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' } },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [first.lng, first.lat], zoom: 15, attributionControl: { compact: false }, cooperativeGestures: true,
      });
      m.addControl(new gl.NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => setMapState("ready"));
      m.on("error", () => setMapState((s) => (s === "ready" ? s : "failed")));
      map.current = m;
    }).catch(() => setMapState("failed"));
    return () => { gone = true; };
  }, [first]);

  useEffect(() => () => { map.current?.remove(); map.current = null; markers.current.clear(); }, []);

  // The markers follow the positions; the first time both are on the map, the view frames them.
  useEffect(() => {
    const m = map.current, gl = window.maplibregl;
    if (!m || !gl || mapState !== "ready") return;
    const seen = new Set<LivePosition["role"]>();
    for (const p of positions) {
      seen.add(p.role);
      let mk = markers.current.get(p.role);
      if (!mk) {
        mk = new gl.Marker({ color: COLOUR[p.role] }).setLngLat([p.lng, p.lat]).setPopup(new gl.Popup({ offset: 28, closeButton: false }).setText(p.role === "leader" ? t.leader : t.sweeper)).addTo(m);
        markers.current.set(p.role, mk);
      } else {
        mk.setLngLat([p.lng, p.lat]);
      }
    }
    for (const [role, mk] of markers.current) if (!seen.has(role)) { mk.remove(); markers.current.delete(role); }
    // Framed once, then again only when Recenter is tapped - never on every answer after it.
    if (positions.length && (!framed.current || recenter !== centred.current)) {
      framed.current = true;
      centred.current = recenter;
      const lats = positions.map((p) => p.lat), lngs = positions.map((p) => p.lng);
      if (positions.length > 1) m.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 60, maxZoom: 16, duration: 600 });
      else m.easeTo({ center: [positions[0].lng, positions[0].lat], zoom: Math.max(m.getZoom(), 15), duration: 600 });
    }
  }, [positions, mapState, recenter, t.leader, t.sweeper]);

  const clock = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat(intlOf(locale), { hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(d);
  };
  const kmh = (ms: number | null) => (ms === null ? "" : t.speed(String(Math.round(ms * 3.6))));
  const words = { signin: t.signin, not_booked: t.notBooked, unavailable: t.unavailable, network: t.network };
  const note = !answer ? "" : answer.ok ? (answer.positions.length ? "" : t.noPosition) : words[answer.error];

  return (
    <div className="lv">
      {note && <p className={`lv-note${answer && !answer.ok ? " warn" : ""}`} role="status">{note}</p>}
      {shown && (
        <div className="lv-map-wrap">
          <div ref={box} className="lv-map" aria-label={t.leader} />
          {mapState !== "ready" && <p className="lv-map-note">{mapState === "failed" ? t.mapFailed : t.loading}</p>}
        </div>
      )}
      {positions.length > 0 && (
        <div className="lv-legend">
          {positions.map((p) => (
            <span key={p.role} className="lv-chip" style={{ ["--c" as string]: COLOUR[p.role] }}>
              <i aria-hidden="true" /><strong>{p.role === "leader" ? t.leader : t.sweeper}</strong>
              {p.at && <span>{t.updated(clock(p.at))}</span>}
              {p.speed !== null && p.speed > 0.5 && <span>{kmh(p.speed)}</span>}
            </span>
          ))}
          {mapState === "ready" && <button type="button" className="lv-btn" onClick={() => setRecenter((n) => n + 1)}>{t.recenter}</button>}
        </div>
      )}
    </div>
  );
}
