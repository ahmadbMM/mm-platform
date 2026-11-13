// A rider's personal landmarks on My Account > Stats, as the booking app draws them (new features build F16, 2026-11-13:
// _lmAnniv, _lmLine, _lmKindsHtml, LM_KINDS): two private things worked out from the rider's own bookings, nothing sent
// as a message. Plain logic, so it can be tested; Landmarks.tsx draws them.
import type { RideKind } from "./rides";
import type { SiteContent } from "./site";

/** The first ride's anniversary: for the seven days from its date, every year (_lmAnniv). `first` is the first completed
 *  BIKE ride (the date Your rides calls First ride: a pool session or a workshop starts no anniversary), `today` the day
 *  on the rides' calendar (Riyadh). The card shows on the day itself and the six after it, never before; a first ride on
 *  29 February keeps 28 February in a year without one; a week that runs over New Year is last year's date, tried second. */
export function anniversaryOf(first: string | null | undefined, today: string): { years: number; first: string } | null {
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(first ?? "")), y0 = Number(String(today).slice(0, 4));
  if (!m || !y0) return null;
  const on = (y: number) => `${y}-${m[2]}-${m[2] === "02" && m[3] === "29" && new Date(Date.UTC(y, 1, 29)).getUTCMonth() !== 1 ? "28" : m[3]}`;
  for (const y of [y0, y0 - 1]) {
    const n = y - Number(m[1]), d = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${on(y)}T00:00:00Z`)) / 864e5);
    if (n >= 1 && d >= 0 && d < 7) return { years: n, first: m[0] };
  }
  return null;
}

/** The team's own line on the card (_lmLine): the admins' text for the reader's language, kept in site_content
 *  'msg.templates' as lm_anniv {<lang>: text} (the booking app's Settings > Message templates), else null and the card
 *  says the built-in line in that language. A language the admins wrote nothing in keeps its own built-in line. */
export function annivLine(content: SiteContent | null | undefined, locale: string): string | null {
  const t = content?.["msg.templates"];
  const o = t && typeof t === "object" ? (t as Record<string, unknown>).lm_anniv : null;
  const v = o && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, locale) ? (o as Record<string, unknown>)[locale] : null;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** The kinds of session the checklist names, in its order (LM_KINDS). */
export const LM_KINDS: readonly RideKind[] = ["jcc", "saturday", "petromin", "swim", "yoga", "workshop", "event", "snd96", "runher", "defe5k", "vlap", "arena", "blood"];

/** The kinds tried, under By event (_lmKindsHtml): every kind with a date the rider can still book (`open`) and every
 *  kind already done (`done`: the nights by kind, as By event counts them), each ticked once one was completed. So an
 *  event that is over is listed only for those who did it. A list of one is not a checklist: none then. */
export function triedKinds(done: Iterable<RideKind>, open: Iterable<RideKind>): { kind: RideKind; done: boolean }[] {
  const d = new Set(done), o = new Set(open);
  const K = LM_KINDS.filter((k) => d.has(k) || o.has(k));
  return K.length < 2 ? [] : K.map((kind) => ({ kind, done: d.has(kind) }));
}
