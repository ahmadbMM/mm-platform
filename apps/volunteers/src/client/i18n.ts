// The portal's words. English rides in the bundle; every other language is fetched when chosen and
// falls back to English for anything missing. The booking app's ten languages. Numbers stay in Latin
// digits in every language, as they do in the booking app.

import en from "../lang/en.json";

export type Key = keyof typeof en;

export const LANGS: { code: string; label: string; rtl?: boolean }[] = [
  { code: "en", label: "English" },
  { code: "ar", label: "العربية", rtl: true },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "ur", label: "اردو", rtl: true },
  { code: "hi", label: "हिन्दी" },
  { code: "tl", label: "Tagalog" },
  { code: "ne", label: "नेपाली" },
  { code: "bn", label: "বাংলা" },
];
const LANG_KEY = "mm_vol_lang";

let lang = "en";
let words: Partial<Record<Key, string>> = {};

export const currentLang = () => lang;

export function t(key: Key, ...args: (string | number)[]): string {
  let s = words[key] ?? en[key];
  args.forEach((a, i) => { s = s.split(`{${i}}`).join(String(a)); });
  return s;
}

/** Hours with their word, by the language's plural (the booking app's _tn('accVolHrs'), 2026-11-09): "1 hour",
 *  "6 hours", "2.5 hours"; Arabic "ساعة واحدة", "ساعتان", "3 ساعات", "11 ساعة". Two decimals at most. */
export function hoursN(hours: number | string | null | undefined): string {
  const n = Math.round((Number(hours) || 0) * 100) / 100;
  let c: Intl.LDMLPluralRule = "other";
  try { c = new Intl.PluralRules(lang).select(n); } catch { /* an engine without the language: "other" */ }
  return t(`hours_${c}` as Key, String(n));
}

export async function setLang(code: string): Promise<void> {
  const L = LANGS.find((x) => x.code === code) ?? LANGS[0];
  if (L.code !== "en") {
    try {
      const res = await fetch(`/lang/${L.code}.json`);
      if (!res.ok) return;
      words = (await res.json()) as Partial<Record<Key, string>>;
    } catch {
      return; // no signal: the page stays in the language it has
    }
  } else {
    words = {};
  }
  lang = L.code;
  document.documentElement.lang = L.code;
  document.documentElement.dir = L.rtl ? "rtl" : "ltr";
  try { localStorage.setItem(LANG_KEY, L.code); } catch { /* blocked storage: this visit only */ }
}

/** The saved language, else the phone's, else English. */
export function startLang(): string {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && LANGS.some((l) => l.code === saved)) return saved;
  } catch { /* blocked storage */ }
  const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
  return LANGS.some((l) => l.code === nav) ? nav : "en";
}

const locale = () => `${lang}-u-ca-gregory-nu-latn`;
const KSA = "Asia/Riyadh";

/** A day from a session's date (YYYY-MM-DD), read as noon in Riyadh so no time zone can move it. */
export function dayLabel(ymd: string | null | undefined): string {
  const m = /^\d{4}-\d{2}-\d{2}/.exec(String(ymd ?? ""));
  if (!m) return "";
  try {
    return new Date(`${m[0]}T12:00:00+03:00`).toLocaleDateString(locale(), { timeZone: KSA, weekday: "short", day: "numeric", month: "short" });
  } catch {
    return m[0];
  }
}

/** A session's date as the date block shows it: the month, the day and the weekday, in Riyadh. */
export function dateParts(ymd: string | null | undefined): { month: string; day: string; weekday: string } | null {
  const m = /^\d{4}-\d{2}-\d{2}/.exec(String(ymd ?? ""));
  if (!m) return null;
  const d = new Date(`${m[0]}T12:00:00+03:00`);
  const part = (o: Intl.DateTimeFormatOptions) => { try { return d.toLocaleDateString(locale(), { timeZone: KSA, ...o }); } catch { return ""; } };
  return { month: part({ month: "short" }), day: String(Number(m[0].slice(8, 10))), weekday: part({ weekday: "short" }) };
}

/** A date with its year ("2 April 1995"), read as noon in Riyadh. */
export function longDate(ymd: string | null | undefined): string {
  const m = /^\d{4}-\d{2}-\d{2}/.exec(String(ymd ?? ""));
  if (!m) return "";
  try {
    return new Date(`${m[0]}T12:00:00+03:00`).toLocaleDateString(locale(), { timeZone: KSA, day: "numeric", month: "long", year: "numeric" });
  } catch {
    return m[0];
  }
}

/** A moment's time of day in Riyadh ("5:02 PM"). */
export function timeLabel(at: string | null | undefined): string {
  const ms = at ? Date.parse(at) : NaN;
  if (!Number.isFinite(ms)) return "";
  try {
    return new Date(ms).toLocaleTimeString(locale(), { timeZone: KSA, hour: "numeric", minute: "2-digit" });
  } catch {
    return String(at);
  }
}

/** Today in Riyadh, YYYY-MM-DD. */
export const ksaToday = (): string => new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);

/** The Riyadh day (YYYY-MM-DD) of a moment the database wrote, such as a certificate's issued_at. The database writes
 *  it in UTC, so its first ten characters are the day before for anything between midnight and 3 a.m. in Riyadh.
 *  Built from the moment itself, never from a locale's date format (an iPhone gave en-CA as 10/27/2026). */
export function ksaDay(at: string | null | undefined): string {
  const raw = String(at ?? "");
  const ms = Date.parse(raw.replace(/(\.\d{3})\d+/, "$1")); // microseconds, which not every browser reads
  return Number.isFinite(ms) ? new Date(ms + 3 * 3600000).toISOString().slice(0, 10) : raw.slice(0, 10);
}

/** A moment, as a day and a time in Riyadh. */
export function whenLabel(at: string | null | undefined): string {
  const ms = at ? Date.parse(at) : NaN;
  if (!Number.isFinite(ms)) return "";
  try {
    return new Date(ms).toLocaleString(locale(), { timeZone: KSA, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  } catch {
    return String(at);
  }
}

/** Does a session keep its times as "gather - start" rather than "start - end"? The booking app's _gathersTime: the
 *  Saturday ride (and any community kind it does not name), the National Day ride, Run for Her and Victory Lap gather,
 *  and their second time is when they set off, not when they end. */
export function gathers(s: { ride_kind?: string | null; event_kind?: string | null }): boolean {
  const kind = s.ride_kind ?? "";
  if (kind === "snd96") return true;
  if (s.event_kind !== "community") return false; // the circuit's own nights: a window
  return !["event", "petromin", "swim", "workshop", "arena", "defe5k", "blood"].includes(kind);
}

/** A session's times as staff typed them ("17:00 - 23:00"), each in this language's clock. A session that gathers
 *  (gathers()) says which is the gathering and which the start: read as a range, its shift ended as it began. */
export function timesLabel(raw: string | null | undefined, gather = false): string {
  const parts = String(raw ?? "").split(/\s*[-–]\s*/).filter(Boolean).map((p) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(p.trim());
    if (!m) return p.trim();
    try {
      return new Date(Date.UTC(2026, 0, 1, Number(m[1]), Number(m[2]))).toLocaleTimeString(locale(), { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
    } catch {
      return p.trim();
    }
  });
  return gather && parts.length === 2 ? t("timesGather", parts[0], parts[1]) : parts.join(" – ");
}

const KIND_NAMES: Record<string, Key> = { saturday: "evSatName", petromin: "evPetroName", swim: "evSwimName", workshop: "evWorkshopName", snd96: "evSnd96Name",
  event: "evEventName", runher: "evRunHerName", vlap: "evVlapName", arena: "evArenaName", defe5k: "evDefeName", blood: "evBloodName" };
function nameIn(s: { title?: string | null; ride_kind?: string | null }, word: (k: Key) => string): string {
  const kind = s.ride_kind ?? "";
  if (!Object.prototype.hasOwnProperty.call(KIND_NAMES, kind)) return word("evJccName");
  return s.title || word(KIND_NAMES[kind]);
}
/** A session's name: its own title, or its kind's name (the booking app's _evName). */
export function sessionName(s: { title?: string | null; ride_kind?: string | null }): string {
  return nameIn(s, (k) => t(k));
}
/** The same name in English, whatever language the page is in: what a certificate is issued with. The certificate
 *  prints in English, and every reprint and its public check show what it was issued with. */
export function sessionNameEn(s: { title?: string | null; ride_kind?: string | null }): string {
  return nameIn(s, (k) => en[k]);
}
