// Each kind of session's drawn mark, and the Saturday ride's two routes, as the booking app draws them (app.src.html
// KIND_IC and its _CU glyphs, _satRouteSvg; the owner's picks on its theming page, 2026-11-13). Drawn, never a picture or
// a character: the marks take the colour they sit in (the kind's ink on its tint), and the route turns round for Arabic.

/** The booking app's glyph for each kind (KIND_IC): people for the Saturday ride, the water for the pool, three speed
 *  stripes for a Petromin night, a lotus for yoga, a barn for the Farm House Night (2026-11-13), a runner for the runs,
 *  and so on; a bike for anything else. */
const GLYPH: Record<string, string> = {
  people: "M3.4 19.4c.6-3.2 2.8-5 5.6-5s5 1.8 5.6 5M15.2 5.9a3 3 0 0 1 0 5.6M17.6 14.6c1.7.6 2.8 2.2 3.1 4.8",
  wave: "M2.8 9.2c1.5-1.3 3.1-1.3 4.6 0s3.1 1.3 4.6 0 3.1-1.3 4.6 0 3.1 1.3 4.6 0M2.8 14.8c1.5-1.3 3.1-1.3 4.6 0s3.1 1.3 4.6 0 3.1-1.3 4.6 0 3.1 1.3 4.6 0",
  stripes: "M4 18 9 6M10 18l5-12M16 18l5-12",
  ticket: "M3.6 7.6A1.6 1.6 0 0 1 5.2 6h13.6a1.6 1.6 0 0 1 1.6 1.6V10a2 2 0 0 0 0 4v2.4a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V14a2 2 0 0 0 0-4zM14.4 6.6v1.6M14.4 11.2v1.6M14.4 15.8v1.6",
  clock: "M12 7.4V12l3.2 2",
  flag: "M5.4 21V3.8M5.4 4.4h11.8l-2.4 4 2.4 4H5.4",
  run: "M13.9 8.1l-2.5 4.9 3 2.4-.9 4.9M11.4 13l-3 1.6-2.6-1.2M13.6 8.6l-3.1.7-1.6 2.1M13.6 8.6l2.6 2.4 2.6-.6",
  lotus: "M12 4.6c-2.1 2.8-2.1 7 0 10.4 2.1-3.4 2.1-7.6 0-10.4zM12 15c-1.5-3.3-4.4-5.1-7.8-5.1.2 3.7 3.4 5.6 7.8 5.1zM12 15c1.5-3.3 4.4-5.1 7.8-5.1-.2 3.7-3.4 5.6-7.8 5.1zM4.6 18.6h14.8",
  bike: "M5.9 15.6L9.4 8.7l2.3 6.9zM9.4 8.7h6.4l-4.1 6.9M15.8 8.7l2.3 6.9M9.4 8.7L8.9 6.6M7.5 6.6h3M15.8 8.7l-.7-2.5h2.7",
  // the booking app's _CU.barn: a gabled barn on the ground, its door crossed
  barn: "M3.5 20.5V10L12 4l8.5 6v10.5M2.5 20.5h19M9 20.5v-6h6v6M9 14.5l6 6M15 14.5l-6 6",
};
/** The circles some glyphs have, beside their paths. */
const DOTS: Record<string, [number, number, number][]> = {
  people: [[9, 8.6, 3.1]], clock: [[12, 12, 8.6]], run: [[14.9, 4.6, 1.9]], bike: [[5.9, 15.6, 3.9], [18.1, 15.6, 3.9]],
};
const KIND_GLYPH: Record<string, string> = {
  saturday: "people", petromin: "stripes", event: "ticket", workshop: "clock", swim: "wave", snd96: "flag", jcc: "bike",
  runher: "run", vlap: "flag", arena: "flag", defe5k: "run", blood: "ticket", yoga: "lotus", farm: "barn",
};

export function KindIcon({ kind, size = 16 }: { kind: string; size?: number }) {
  const g = KIND_GLYPH[kind] ?? "bike";
  return (
    <svg className="mm-ic k-ic" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {(DOTS[g] ?? []).map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} />)}
      <path d={GLYPH[g]} />
    </svg>
  );
}

/** The route's words, ready in the page's language: the two groups' distances ("20 km", "40 km") and the three places. */
export type RouteWords = { beg: string; int: string; start: string; begPlace: string; intPlace: string };

/** The Saturday ride's two routes as one line (the booking app's _satRouteSvg, the owner's pick D1): the start, the
 *  beginners' turn at the Jeddah Yacht Club, the intermediates' turn before the Marine Sciences roundabout, and the way
 *  back dotted. It turns round for Arabic and Urdu; the place names sit on two rows so the longest never meet. The date's
 *  text says the same in words, so the drawing is hidden from a screen reader. */
export function SatRoute({ w, rtl }: { w: RouteWords; rtl: boolean }) {
  const X = (x: number) => (rtl ? 320 - x : x);
  const A = (a: "start" | "middle" | "end") => (rtl ? (a === "start" ? "end" : a === "end" ? "start" : a) : a);
  const pill = (x: number, y: number, txt: string) => (
    <g className="sr-pill"><rect x={X(x) - 22} y={y} width="44" height="15" rx="7.5" /><text x={X(x)} y={y + 10.8} textAnchor="middle">{txt}</text></g>
  );
  const lb = (x: number, y: number, a: "start" | "middle" | "end", txt: string) => <text className="sr-lb" x={X(x)} y={y} textAnchor={A(a)}>{txt}</text>;
  return (
    <svg className="sr-route" viewBox="0 0 320 86" direction="ltr" aria-hidden="true" focusable="false">
      <path className="sr-back" d={`M${X(16)} 52 C${X(70)} 52 ${X(110)} 58 ${X(150)} 56 S${X(250)} 50 ${X(296)} 50`} />
      <path className="sr-ln" d={`M${X(16)} 42 C${X(70)} 42 ${X(110)} 34 ${X(150)} 36 S${X(250)} 44 ${X(296)} 38`} />
      <circle className="sr-st" cx={X(16)} cy="42" r="5" /><circle className="sr-tn" cx={X(150)} cy="36" r="4.2" /><circle className="sr-tn" cx={X(296)} cy="38" r="4.2" />
      {pill(150, 10, w.beg)}{pill(296, 12, w.int)}
      {lb(150, 71, "middle", w.begPlace)}{lb(6, 84, "start", w.start)}{lb(314, 84, "end", w.intPlace)}
    </svg>
  );
}
