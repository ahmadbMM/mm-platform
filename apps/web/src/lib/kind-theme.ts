// The Experiences card, its list and the Saturday ride, as the booking app has them since the owner's picks on its
// theming page (2026-11-13; app.src.html _commMarks, _regKindsHtml, _sunriseMin, _satRouteSvg): the card shows a mark
// for each kind it has dates for, in a fixed order; a list holding two or more kinds offers a switch in that order;
// the Saturday ride says when the sun rises over the Corniche and draws its two routes. Plain logic, so it can be
// tested: the page puts the words together (app/[locale]/experiences/page.tsx) and ExperienceSteps.tsx draws them.

/** The kinds in the order the card's marks and the list's switch name them (the booking app's COMM_MARKS): the
 *  Saturday ride, the pool, Petromin, yoga, the Farm House Night (2026-11-13), the DEFE run; any other kind after them,
 *  as it comes. */
export const KIND_ORDER = ["saturday", "swim", "petromin", "yoga", "farm", "defe5k"] as const;

/** The kinds that have a drawing of their own (the booking app's KIND_ART): the Saturday ride's dawn, the pool's water,
 *  a Petromin night's stripes, across the top of a date's Details and as the motif along its row's foot. */
export const KIND_ART: readonly string[] = ["saturday", "swim", "petromin"];
export const hasKindArt = (kind: string): boolean => KIND_ART.includes(kind);

const rank = (k: string) => {
  const i = (KIND_ORDER as readonly string[]).indexOf(k);
  return i < 0 ? 99 : i;
};

/** The kinds among these sessions, each once, in KIND_ORDER (others after, in the order they first come). */
export function kindsInOrder(sessions: readonly { kind: string }[]): string[] {
  const seen = [...new Set(sessions.map((s) => s.kind))];
  return seen.map((k, i) => ({ k, i })).sort((a, b) => rank(a.k) - rank(b.k) || a.i - b.i).map((x) => x.k);
}

/** The card's marks (the booking app's _commMarks): one per kind of KIND_ORDER it has a date for, in that order; a kind
 *  outside that list has no mark. */
export function kindMarks(sessions: readonly { kind: string }[]): string[] {
  const on = new Set(sessions.map((s) => s.kind));
  return KIND_ORDER.filter((k) => on.has(k));
}

/** The rows a kind switch leaves (the booking app's renderRegister): every row when nothing is picked, the list holds
 *  one kind only or the kind picked is no longer on it; else that kind's rows. It narrows the rows, nothing else. */
export function rowsOfKind<T extends { kind: string }>(sessions: readonly T[], pick: string | null): T[] {
  const kinds = new Set(sessions.map((s) => s.kind));
  return pick && kinds.size > 1 && kinds.has(pick) ? sessions.filter((s) => s.kind === pick) : [...sessions];
}

/** Sunrise on the Corniche that day, in minutes after midnight in Riyadh time (UTC+3, no daylight saving), or null: the
 *  NOAA formula for 21.5433 N 39.1728 E, word for word the booking app's _sunriseMin (6:33 on 14 Nov 2026). */
export function sunriseMin(d: string): number | null {
  const ms = Date.parse(String(d || "").slice(0, 10) + "T12:00:00Z");
  if (!isFinite(ms)) return null;
  const y = new Date(ms).getUTCFullYear(), g = 2 * Math.PI / 365 * ((ms - Date.UTC(y, 0, 1)) / 864e5 - .85), c = Math.cos, n = Math.sin;
  const eq = 229.18 * (.000075 + .001868 * c(g) - .032077 * n(g) - .014615 * c(2 * g) - .040849 * n(2 * g));
  const dc = .006918 - .399912 * c(g) + .070257 * n(g) - .006758 * c(2 * g) + .000907 * n(2 * g) - .002697 * c(3 * g) + .00148 * n(3 * g), la = 21.5433 * Math.PI / 180;
  const ha = Math.acos(c(90.833 * Math.PI / 180) / (c(la) * c(dc)) - Math.tan(la) * Math.tan(dc)) * 180 / Math.PI;
  const m = Math.floor(720 - 4 * (39.1728 + ha) - eq + 180);
  return isFinite(m) ? m : null;
}

/** Sunrise that day as "HH:MM", for the page's clock to write; null when the date cannot be read. */
export function sunriseHhmm(d: string): string | null {
  const m = sunriseMin(d);
  return m == null ? null : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** The Saturday ride's two distances, from the session's settings (bike_slots._km {beg, int}; the owner, 2026-10-02),
 *  as the booking app's _rgKm reads them: a value from just above 0 to 500, else the usual 20 and 40 km. */
export const RIDE_GROUP_KM = { beg: 20, int: 40 } as const;
export function rideGroupKm(slots: unknown): { beg: number; int: number } {
  let o: unknown = slots;
  if (typeof o === "string") {
    try { o = JSON.parse(o); } catch { o = null; }
  }
  const k = o && typeof o === "object" ? (o as Record<string, unknown>)._km : null;
  const one = (g: "beg" | "int") => {
    const v = k && typeof k === "object" ? Number((k as Record<string, unknown>)[g]) : NaN;
    return v > 0 && v <= 500 ? v : RIDE_GROUP_KM[g];
  };
  return { beg: one("beg"), int: one("int") };
}
