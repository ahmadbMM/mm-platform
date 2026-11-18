"use client";

import { useEffect, useRef, useState } from "react";
import { JEDDAH, pinOk, roundPin, type Pin } from "@/lib/sx-b3";
import type { SxText } from "./sx-B3.text";
import { SxIcon } from "./sx-b3-icons";

// The map a Jeddah delivery is pinned on (N07, 2026-11-18): MapLibre GL on OpenStreetMap's raster tiles, as the live ride
// map draws it (components/live/LiveMap.tsx): no paid key, and the site's Content-Security-Policy already allows those
// two pinned files and the tiles (lib/security-headers.ts; a test keeps this version the live map's). The pin stays in
// the middle and the map moves under it; "Use my location" asks the phone once (Permissions-Policy geolocation=(self)).
// The point is kept with the order for the driver alone (staff's order sheet: Open in Maps), never shown to anyone else.
const MAPLIBRE = "https://cdn.jsdelivr.net/npm/maplibre-gl@5.12.0/dist/maplibre-gl";
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

type MapApi = {
  on(ev: string, fn: () => void): void; remove(): void; getCenter(): { lat: number; lng: number };
  easeTo(o: Record<string, unknown>): void; addControl(c: unknown, pos?: string): void;
};
type Gl = { Map: new (o: Record<string, unknown>) => MapApi; NavigationControl: new (o: Record<string, unknown>) => unknown };

let loading: Promise<Gl> | null = null;
function loadGl(): Promise<Gl> {
  const w = window as unknown as { maplibregl?: Gl };
  if (w.maplibregl) return Promise.resolve(w.maplibregl);
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
    s.onload = () => (w.maplibregl ? resolve(w.maplibregl) : reject(new Error("maplibre")));
    s.onerror = () => { loading = null; reject(new Error("maplibre")); };
    document.head.appendChild(s);
  });
  return loading;
}

export default function PinMap({ start, x, onUse }: { start: Pin | null; x: SxText; onUse: (p: Pin) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapApi | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [err, setErr] = useState("");
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    let live = true;
    const at = start ?? JEDDAH;
    loadGl().then((gl) => {
      if (!live || !box.current) return;
      const m = new gl.Map({
        container: box.current,
        style: {
          version: 8,
          sources: { osm: { type: "raster", tiles: [TILES], tileSize: 256, maxzoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' } },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [at.lng, at.lat], zoom: start ? 17 : 11, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false,
      });
      m.addControl(new gl.NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => { if (live) setState("ready"); });
      map.current = m;
    }).catch(() => { if (live) setState("failed"); });
    return () => { live = false; map.current?.remove(); map.current = null; };
    // the map is made once for the pop-up's life; a new start point comes with a new pop-up
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    setErr("");
    if (!("geolocation" in navigator)) { setErr(x.checks.locate_off); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition((p) => {
      setLocating(false);
      const here = { lat: p.coords.latitude, lng: p.coords.longitude };
      if (!pinOk(here)) { setErr(x.checks.pin_out); return; }
      map.current?.easeTo({ center: [here.lng, here.lat], zoom: 17, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 600 });
    }, () => { setLocating(false); setErr(x.checks.locate_off); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  function use() {
    const c = map.current?.getCenter();
    if (!c) return;
    const p = roundPin({ lat: c.lat, lng: c.lng });
    if (!pinOk(p)) { setErr(x.checks.pin_out); return; }
    onUse(p);
  }

  return (
    <div className="sx3-map">
      <div className="sx3-map-box">
        <div ref={box} className="sx3-map-gl" role="application" aria-label={x.pinHere} />
        {state !== "failed" && <span className="sx3-map-pin" aria-hidden="true"><SxIcon name="pin" size={40} /></span>}
        {state === "failed" && <p className="sx3-map-off" role="alert">{x.checks.map_off}</p>}
      </div>
      <p className="bk-ferr" role="alert">{err}</p>
      <div className="sx3-map-acts">
        <button type="button" className="bk-btn2" onClick={locate} disabled={locating || state !== "ready"} aria-busy={locating}>
          <SxIcon name="locate" size={18} />{x.locate}
        </button>
        <button type="button" className="bk-btn" onClick={use} disabled={state !== "ready"}>{x.pinUse}</button>
      </div>
    </div>
  );
}
