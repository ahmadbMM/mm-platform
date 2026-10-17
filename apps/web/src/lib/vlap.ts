// Victory Lap by Fitness Empire (the booking app, 2026-10-17; rentals migration 20261017210000): a hybrid
// fitness race at the Jeddah Corniche Circuit on 26 October 2026, run by Kamin Sports and booked in the
// booking app (ride_kind 'vlap', event_kind 'community', a paid ride at the session's own price, 150 SAR
// per athlete, VAT included). Its card shows to everyone; only Community members and Victory Lap tag
// holders may book it (vlap_member), and only they are told the price. Five races (Women's / Men's
// Singles, Women's / Men's / Mixed Doubles), four divisions (Sprint Open and Sprint Elite: 4 km; Open and
// Elite: 6.1 km). Every account books only itself: a Doubles team is two bookings joined by a team code
// (VL-XXXX). One Singles and one Doubles place per account at most, each its own ticket. Every athlete
// agrees that their details go to Kamin Sports (lib/share.ts), and a finished race (status done) earns the
// lap ring (victory_lap, lib/ride-record.ts). The plain rules, as the booking app's VL_* and _vl*, so they
// can be tested; the database (_vl_entry_guard) holds every rule that matters.

export const VL_RACES = ["ws", "ms", "wd", "md", "xd"] as const;
export type VlRace = (typeof VL_RACES)[number];
export const VL_DIVS = ["so", "se", "op", "el"] as const;
export type VlDiv = (typeof VL_DIVS)[number];
export const VL_SHIRTS = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export const VL_T5K = ["u20", "m2030", "o30"] as const;
export type VlT5k = (typeof VL_T5K)[number];
/** The Doubles races (VL_DBL): a team of two, joined by a code. */
const VL_DBL: readonly string[] = ["wd", "md", "xd"];
/** Each division's distance in km (VL_DIV_KM). */
export const VL_DIV_KM: Record<VlDiv, number> = { so: 4, se: 4, op: 6.1, el: 6.1 };
/** The divisions' names, Kamin Sports' own: the booking app keeps them in English in every language but
 *  Arabic (vlDiv_*), so they are not translated here either - and "Elite" and "Open" would otherwise take
 *  the dictionaries' words for the Club's Elite tier and an open door. */
const VL_DIV_NAME: Record<"en" | "ar", Record<VlDiv, string>> = {
  en: { so: "Sprint Open", se: "Sprint Elite", op: "Open", el: "Elite" },
  ar: { so: "سبرنت مفتوح", se: "سبرنت النخبة", op: "مفتوح", el: "النخبة" },
};
export const vlDivName = (d: VlDiv, locale: string): string => VL_DIV_NAME[locale === "ar" ? "ar" : "en"][d];
export const vlDivNames = (locale: string): Record<VlDiv, string> => VL_DIV_NAME[locale === "ar" ? "ar" : "en"];

const has = <T extends string>(all: readonly T[], v: unknown): v is T => typeof v === "string" && (all as readonly string[]).includes(v);
const obj = (v: unknown): Record<string, unknown> | null => {
  let o = v;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { return null; } }
  return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : null;
};

/** A Doubles race (_vlIsDbl). */
export const vlIsDbl = (race: string | null | undefined): boolean => !!race && VL_DBL.includes(race);

/** An athlete's place (queue_entries.vl): the race, the division, the T-shirt, the 5 km time, the team
 *  code (Doubles) and whether they asked our team for a partner. */
export type VlEntry = { race: VlRace | null; div: VlDiv | null; shirt: string | null; t5k: VlT5k | null; team: string | null; pair: boolean };

/** queue_entries.vl as the ticket reads it (_vlOf): an object (or its JSON text), else null. A value the
 *  booking app would not take reads as none; a team code only on a Doubles race. */
export function vlEntry(v: unknown): VlEntry | null {
  const o = obj(v);
  if (!o) return null;
  const race = has(VL_RACES, o.race) ? o.race : null;
  const team = typeof o.team === "string" && /^VL-[A-Z0-9]{1,12}$/.test(o.team.trim().toUpperCase()) ? o.team.trim().toUpperCase() : null;
  const shirt = typeof o.shirt === "string" && has(VL_SHIRTS, o.shirt.trim().toUpperCase()) ? o.shirt.trim().toUpperCase() : null;
  return {
    race,
    div: has(VL_DIVS, o.div) ? o.div : null,
    shirt,
    t5k: has(VL_T5K, o.t5k) ? o.t5k : null,
    team: vlIsDbl(race) ? team : null,
    pair: vlIsDbl(race) && !team && (o.pair === true || o.pair === "true"),
  };
}

/** Which of an account's two places a booking is (_vlCat): 'd' Doubles, 's' Singles (a booking with no
 *  race yet counts as Singles). A Singles and a Doubles place on the same session are two tickets. */
export const vlCat = (e: Pick<VlEntry, "race"> | null | undefined): "s" | "d" => (e && vlIsDbl(e.race) ? "d" : "s");

/** Staff's words in a language ({en, ar, ...}), as sessions.vl holds them. */
export type VlWords = Record<string, string>;
/** The race's settings (sessions.vl, staff's; _vlCfg): the races and divisions open to book (all when
 *  unset), whether an athlete may ask for a partner, how to pay, and what goes to Kamin Sports. */
export type VlConfig = { races: VlRace[]; divs: VlDiv[]; pair: boolean; pay: VlWords; share: VlWords };

const words = (v: unknown): VlWords => {
  const o = obj(v);
  return o ? Object.fromEntries(Object.entries(o).filter((e): e is [string, string] => typeof e[1] === "string")) : {};
};

export function vlConfig(v: unknown): VlConfig {
  const o = obj(v) ?? {};
  const pick = <T extends string>(a: unknown, all: readonly T[]): T[] => (Array.isArray(a) ? all.filter((x) => a.includes(x)) : [...all]);
  return { races: pick(o.races, VL_RACES), divs: pick(o.divs, VL_DIVS), pair: o.pair !== false, pay: words(o.pay), share: words(o.share) };
}

/** Staff's words in the reader's language (_vlWords): theirs in it, else their English, else "". */
export function vlWords(o: VlWords | null | undefined, locale: string): string {
  const v = o && (o[locale] || o.en);
  return typeof v === "string" ? v.trim() : "";
}

/** How to pay, as the ticket says it while the place is unpaid (_vlPayLine): staff's words, else the
 *  page's own `fallback` ("How to pay will be announced soon. Your place is held now."). */
export const vlPayLine = (cfg: VlConfig | null | undefined, locale: string, fallback: string): string => vlWords(cfg?.pay, locale) || fallback;

/** What the share pop-up lists for Victory Lap (_vlShareItems): staff's exact list (sessions.vl.share,
 *  one item a line) once Kamin Sports gives it (`set`), else `fallback`, what the booking holds. */
export function vlShareItems(cfg: VlConfig | null | undefined, locale: string, fallback: string[]): { items: string[]; set: boolean } {
  const own = vlWords(cfg?.share, locale);
  if (own) {
    const items = own.split(/\n+/).map((x) => x.replace(/^[\s\-•·*]+/, "").trim()).filter(Boolean);
    if (items.length) return { items, set: true };
  }
  return { items: fallback, set: false };
}
