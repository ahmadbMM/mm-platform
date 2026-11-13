import { LOCALE_CODES, intlOf } from "@/i18n/locales";

// "Ask" (micromobility.sa/ask): MicroMobility's own audience questions - a page of questions that people answer
// signed in with their account, with the results drawn for everyone the page is for. The parts that are plain logic,
// kept apart from the cookie, network and drawing code so they can be tested: reading what the database's functions
// answer (ask_list, ask_page, ask_live, ask_screen, ask_send; migration 20261113010000 in the booking app), choosing a
// text for a language, which results a viewer may see, an answer's value for its kind, and when to ask again.
//
// Nothing here trusts a shape: a field that is missing or of the wrong type takes its default, a question of a kind
// these pages do not draw yet (grid, pin, form, quiz, quiz_text) is kept and drawn as nothing, and an answer that is
// not a page at all reads as "none".

/* ------------------------------------------------------------------ addresses, codes, words */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A page's link part: lower-case letters, digits and single dashes, 3 to 40 characters. */
export const askSlugOk = (s: unknown): s is string => typeof s === "string" && s.length >= 3 && s.length <= 40 && SLUG.test(s);

/** Digits as typed on an Arabic or a Persian keyboard, as the Latin ones every number on the site is written in. */
export const latinDigits = (s: string): string =>
  s.replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));

/** A page's 6-digit code as typed (Arabic and Persian digits too, spaces and dashes between them), or null. */
export function askCode(raw: unknown): string | null {
  const d = latinDigits(String(raw ?? "")).replace(/[\s\-‐-―.]/g, "");
  return /^\d{6}$/.test(d) ? d : null;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const int = (v: unknown): number | null => { const n = num(v); return n !== null && Number.isInteger(n) ? n : null; };
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const when = (v: unknown): string | null => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Staff write a text in English and/or Arabic: Arabic readers get the Arabic (else the English), everyone else the
 *  English (else the Arabic). It is never translated. */
export function askText(locale: string, en: unknown, ar: unknown): string {
  const e = str(en).trim(), a = str(ar).trim();
  return locale === "ar" ? a || e : e || a;
}

/** The language an answer is sent in (ask_send's p_lang): the page's, when it is one of the site's. */
export const askLang = (v: unknown): string => ((LOCALE_CODES as readonly string[]).includes(String(v)) ? String(v) : "en");

/** A closing or opening time as the page writes it, in Jeddah's time and the reader's language: "Wed 18 Nov, 21:00". */
export function askWhen(iso: string | null | undefined, locale: string): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return "";
  return new Intl.DateTimeFormat(intlOf(locale), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" }).format(t);
}

/** A number in a result, with the reader's decimal mark and Latin digits: 3.4, "3,4". */
export const askNum = (n: number, locale: string, digits = 1): string => new Intl.NumberFormat(intlOf(locale), { maximumFractionDigits: digits }).format(n);
/** A share (0 to 1) as a whole percentage in the reader's language: "40%", "40 %" - always with the sign the site
 *  writes everywhere (%), where Arabic's own would stand beside Latin digits. */
export const askPct = (share: number, locale: string): string =>
  new Intl.NumberFormat(intlOf(locale), { style: "percent", maximumFractionDigits: 0 }).format(clamp(share, 0, 1)).replace(/\u066a/g, "%");

/* ------------------------------------------------------------------ the look (contract section A) */

/** `look` on a page or a question: free keys the pages read, each falling back to its default. */
export type Look = Readonly<Record<string, unknown>>;
export const lookOf = (v: unknown): Look => obj(v) ?? {};

export const ASK_THEMES = ["light", "dark", "green", "sand"] as const;
export type AskTheme = (typeof ASK_THEMES)[number];
/** The page's theme: the ONE place a page's `look.theme` is read (ask.css holds each theme's tokens under
 *  .ask[data-ask-theme]). An unknown name is the light, cream page. */
export const askTheme = (pageLook: Look): AskTheme => (ASK_THEMES as readonly string[]).includes(String(pageLook.theme)) ? (pageLook.theme as AskTheme) : "light";

/** The chart palettes, six colours each, every one 4.5:1 or more on white (the contract's). A chart never reads a
 *  colour of its own: it draws with --ask-c0 ... --ask-c5, which the question's results box sets from here. */
export const ASK_PALETTES = {
  brand: ["#077a4b", "#1a1919", "#0b6e8a", "#b4500b", "#9c1f5c", "#4a4fc4"],
  forest: ["#0b5d3b", "#2e7d32", "#567d2e", "#7a6a1c", "#3f6b5c", "#1f4d3a"],
  ocean: ["#0b6e8a", "#1456a8", "#2b3f9e", "#0d7a7a", "#3a6ea5", "#1b4965"],
  sunset: ["#b4500b", "#a8321f", "#9c1f5c", "#8a5a00", "#b03a48", "#6d3b8f"],
  berry: ["#9c1f5c", "#6d3b8f", "#4a4fc4", "#a8321f", "#7b2d6b", "#3c3f8f"],
  mono: ["#1a1919", "#3a3f3c", "#57605a", "#6f7771", "#2b2f2d", "#454b47"],
} as const satisfies Record<string, readonly string[]>;
export type AskPaletteName = keyof typeof ASK_PALETTES;
const paletteName = (v: unknown): AskPaletteName | null => (typeof v === "string" && Object.hasOwn(ASK_PALETTES, v) ? (v as AskPaletteName) : null);
/** A question's chart colours: its own `look.palette`, else the page's, else the brand's. */
export const askPalette = (questionLook: Look, pageLook: Look): AskPaletteName => paletteName(questionLook.palette) ?? paletteName(pageLook.palette) ?? "brand";
/** The palette as the custom properties a results box sets: { "--ask-c0": "#077a4b", ... }. */
export const paletteVars = (name: AskPaletteName): Record<string, string> => Object.fromEntries(ASK_PALETTES[name].map((c, i) => [`--ask-c${i}`, c]));

/** The chart a question's results are drawn with: its `look.viz` when that chart is built for its kind, else the
 *  kind's first (its default). `built` is the kind's row of the charts' registry (components/ask/results). */
export function askViz(questionLook: Look, built: readonly string[]): string | null {
  const asked = questionLook.viz;
  return typeof asked === "string" && built.includes(asked) ? asked : built[0] ?? null;
}

/* ------------------------------------------------------------------ kinds and their settings */

/** The kinds whose screens are built (stage 1). Any other kind is kept and drawn as nothing. */
export const ASK_DRAWN = ["cloud", "open", "qa", "choice", "scales", "ranking", "points", "number", "info"] as const;
export const isDrawn = (kind: string): boolean => (ASK_DRAWN as readonly string[]).includes(kind);
/** The kinds answered in words, which may wait for approval and take several answers a person. */
export const isWritten = (kind: string): boolean => kind === "cloud" || kind === "open" || kind === "qa";

export type AskOption = { id: string; en: string; ar: string };
/** A question's options (choices, statements, items): those with an id and a text, each id once. */
export function optionsOf(config: unknown): AskOption[] {
  const seen = new Set<string>();
  const out: AskOption[] = [];
  for (const raw of list(obj(config)?.options)) {
    const o = obj(raw);
    const id = str(o?.id);
    if (!o || !/^[a-z0-9]{1,12}$/.test(id) || seen.has(id) || !(str(o.en).trim() || str(o.ar).trim())) continue;
    seen.add(id);
    out.push({ id, en: str(o.en), ar: str(o.ar) });
  }
  return out;
}
export const optionText = (locale: string, o: AskOption): string => askText(locale, o.en, o.ar);

export type WrittenConfig = { maxLen: number; perPerson: number; votes: boolean };
export function writtenConfig(kind: string, config: unknown): WrittenConfig {
  const c = obj(config) ?? {};
  const cloud = kind === "cloud";
  return {
    maxLen: clamp(int(c.max_len) ?? (cloud ? 25 : 200), 1, 500),
    perPerson: clamp(int(c.per_person) ?? (kind === "open" ? 1 : 3), 1, 10),
    votes: typeof c.votes === "boolean" ? c.votes : kind === "qa",
  };
}

export type ChoiceConfig = { options: AskOption[]; maxPicks: number; change: boolean; correct: string[] };
export function choiceConfig(config: unknown): ChoiceConfig {
  const c = obj(config) ?? {};
  const options = optionsOf(c);
  const ids = new Set(options.map((o) => o.id));
  return {
    options,
    maxPicks: clamp(int(c.max_picks) ?? 1, 1, Math.max(1, options.length)),
    change: c.change === true,
    correct: list(c.correct).filter((x): x is string => typeof x === "string" && ids.has(x)),
  };
}

export type ScalesConfig = { options: AskOption[]; min: number; max: number; lo_en: string; lo_ar: string; hi_en: string; hi_ar: string; skip: boolean };
export function scalesConfig(config: unknown): ScalesConfig {
  const c = obj(config) ?? {};
  const min = int(c.min) === 0 ? 0 : 1;
  return { options: optionsOf(c), min, max: clamp(int(c.max) ?? 5, Math.max(3, min + 1), 10), lo_en: str(c.lo_en), lo_ar: str(c.lo_ar), hi_en: str(c.hi_en), hi_ar: str(c.hi_ar), skip: c.skip === true };
}

export type PointsConfig = { options: AskOption[]; total: number };
export function pointsConfig(config: unknown): PointsConfig {
  const c = obj(config) ?? {};
  return { options: optionsOf(c), total: clamp(int(c.total) ?? 100, 1, 1000) };
}

export type NumberConfig = { min: number; max: number; step: number; unit_en: string; unit_ar: string; correct: number | null };
export function numberConfig(config: unknown): NumberConfig {
  const c = obj(config) ?? {};
  const min = num(c.min) ?? 0;
  const max = num(c.max) ?? 100;
  const step = num(c.step) ?? 1;
  return { min: Math.min(min, max), max: Math.max(min, max), step: step > 0 ? step : 1, unit_en: str(c.unit_en), unit_ar: str(c.unit_ar), correct: num(c.correct) };
}

/* ------------------------------------------------------------------ an answer's value, per kind */

/** Why an answer was not taken: the database's codes (ask_send), and "generic" for anything else. */
export const ASK_ERRORS = ["signin", "audience", "closed", "limit", "answered", "empty", "long", "link", "invalid", "late", "throttled"] as const;
export type AskError = (typeof ASK_ERRORS)[number] | "generic";
/** The message a refusal reads as (components/ask/Ask.text.ts `errors`): its own for each code the contract names,
 *  the general one for any other - a code added later never shows as a bare word. */
export const askErrorKey = (code: unknown): AskError =>
  code === "busy" ? "throttled" : (ASK_ERRORS as readonly string[]).includes(String(code)) ? (code as AskError) : "generic";

export type Shaped = { ok: true; value: Record<string, unknown> } | { ok: false; error: AskError };
const no = (error: AskError): Shaped => ({ ok: false, error });
const yes = (value: Record<string, unknown>): Shaped => ({ ok: true, value });

/** Spaces folded, as the database keeps a written answer. */
export const foldSpaces = (s: string): string => s.replace(/\s+/g, " ").trim();
/** Characters as the database counts them (a flag or an accented letter is one). */
export const charCount = (s: string): number => [...s].length;
const LINK = /(?:https?:\/\/|www\.)\S/i;

/** A written answer (cloud, open, qa): {t}. Refused here only where the database surely would - nothing typed (a
 *  word cloud's entry: nothing but marks, which it stores without), longer than the question takes, or an address
 *  written out; the database has the last word on the rest. */
export function shapeWritten(kind: string, config: unknown, text: unknown): Shaped {
  const t = foldSpaces(str(text));
  if (!t || (kind === "cloud" && !/[\p{L}\p{N}]/u.test(t))) return no("empty");
  if (charCount(t) > writtenConfig(kind, config).maxLen) return no("long");
  if (LINK.test(t)) return no("link");
  return yes({ t });
}

/** Multiple choice: {o: [ids]} - one to max_picks of the question's own options, each once. */
export function shapeChoice(config: unknown, picks: unknown): Shaped {
  const c = choiceConfig(config);
  const ids = new Set(c.options.map((o) => o.id));
  const o = [...new Set(list(picks).filter((x): x is string => typeof x === "string"))];
  if (!o.length) return no("empty");
  if (o.length > c.maxPicks || !o.every((id) => ids.has(id))) return no("invalid");
  // in the order staff wrote the options, whatever order they were tapped in
  return yes({ o: c.options.map((x) => x.id).filter((id) => o.includes(id)) });
}

/** Scales: {s: {id: n}} - a whole number from min to max for every statement, or for some of them when the question
 *  lets a statement be skipped. */
export function shapeScales(config: unknown, marks: unknown): Shaped {
  const c = scalesConfig(config);
  const m = obj(marks) ?? {};
  const s: Record<string, number> = {};
  for (const o of c.options) {
    const v = m[o.id];
    if (v === undefined || v === null || v === "") continue;
    const n = int(v);
    if (n === null || n < c.min || n > c.max) return no("invalid");
    s[o.id] = n;
  }
  const given = Object.keys(s).length;
  if (!given) return no("empty");
  if (!c.skip && given < c.options.length) return no("empty");
  return yes({ s });
}

/** Ranking: {r: [ids, best first]} - every option, once. */
export function shapeRanking(config: unknown, order: unknown): Shaped {
  const ids = optionsOf(config).map((o) => o.id);
  const r = list(order).filter((x): x is string => typeof x === "string");
  if (!ids.length || r.length !== ids.length || new Set(r).size !== r.length || !r.every((id) => ids.includes(id))) return no("invalid");
  return yes({ r });
}

/** Points: {p: {id: n}} - whole numbers from 0 for every option, 1 to `total` of them placed in all. */
export function shapePoints(config: unknown, points: unknown): Shaped {
  const c = pointsConfig(config);
  const m = obj(points) ?? {};
  const p: Record<string, number> = {};
  let sum = 0;
  for (const o of c.options) {
    const n = m[o.id] === undefined || m[o.id] === null || m[o.id] === "" ? 0 : int(m[o.id]);
    if (n === null || n < 0) return no("invalid");
    p[o.id] = n;
    sum += n;
  }
  if (!c.options.length || sum > c.total) return no("invalid");
  if (sum < 1) return no("empty");
  return yes({ p });
}

/** A number: {n} - from min to max, on one of the question's steps. Typed with Arabic digits or a decimal comma too. */
export function shapeNumber(config: unknown, raw: unknown): Shaped {
  const c = numberConfig(config);
  const typed = typeof raw === "number" ? String(raw) : str(raw);
  const text = latinDigits(typed).replace(/[٫,]/g, ".").trim();
  if (!text) return no("empty");
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return no("invalid");
  const n = Number(text);
  if (!Number.isFinite(n) || n < c.min || n > c.max) return no("invalid");
  const steps = (n - c.min) / c.step;
  if (Math.abs(steps - Math.round(steps)) > 1e-6) return no("invalid");
  return yes({ n });
}

/** What the viewer sent, read back to fill the answer's own form: each returns what the form holds for that kind. */
export const sentPicks = (value: unknown): string[] => list(obj(value)?.o).filter((x): x is string => typeof x === "string");
export const sentOrder = (value: unknown): string[] => list(obj(value)?.r).filter((x): x is string => typeof x === "string");
export function sentMarks(value: unknown, key: "s" | "p"): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(obj(value)?.[key]) ?? {})) { const n = num(v); if (n !== null) out[k] = n; }
  return out;
}
export const sentNumber = (value: unknown): number | null => num(obj(value)?.n);

/* ------------------------------------------------------------------ what the database answers */

export type AskCard = { slug: string; title_en: string; title_ar: string; closes_at: string | null };
/** ask_list: the open, listed pages this viewer may see, and whether the database took the viewer as signed in. */
export function askList(raw: unknown): { signed: boolean; pages: AskCard[] } {
  const o = obj(raw);
  const pages: AskCard[] = [];
  for (const x of list(o?.pages)) {
    const p = obj(x);
    if (!p || !askSlugOk(p.slug) || !(str(p.title_en).trim() || str(p.title_ar).trim())) continue;
    pages.push({ slug: p.slug, title_en: str(p.title_en), title_ar: str(p.title_ar), closes_at: when(p.closes_at) });
  }
  return { signed: o?.signed === true, pages };
}

export type AskResults = "live" | "answered" | "closed" | "staff";
export type AskQuestion = {
  id: number; pos: number; kind: string; title_en: string; title_ar: string; help_en: string; help_ar: string; image: string | null;
  config: Record<string, unknown>; moderated: boolean; results: AskResults; open: boolean; reveal: boolean; started_at: string | null; look: Look;
};
export type AskMine = { id: number; value: Record<string, unknown>; body: string; status: "pending" | "approved" | "rejected"; answered: boolean; votes: number; created_at: string };
export type AskStats = { answers: number; people: number };
/** ask_live's full answer (and `live` inside ask_page and ask_screen). */
export type AskLive = {
  ver: number; state: "ok" | "closed"; open: boolean; pace: "self" | "live"; current_q: number | null; round: number;
  q: Record<string, { open: boolean; reveal: boolean; started_at: string | null }>;
  results: Record<string, unknown>;
  stats: AskStats | null;
};
export type AskPageInfo = {
  id: number; slug: string; code: string; title_en: string; title_ar: string; intro_en: string; intro_ar: string;
  pace: "self" | "live"; current_q: number | null; opens_at: string | null; closes_at: string | null; round: number; open: boolean; look: Look;
};
/** A page with its questions: state "ok", a closed page that still shows its results, and the big screen. */
export type AskFull = {
  signed: boolean; canAnswer: boolean; preview: boolean; rk: string;
  page: AskPageInfo; questions: AskQuestion[]; mine: Record<string, AskMine[]>; voted: number[]; live: AskLive | null;
};
export type AskState = "none" | "signin" | "audience" | "soon" | "closed" | "ok";
/** What ask_page answered, as the page draws it. `head`: the title of a page that shows no more of itself ("soon",
 *  a closed page that hides its results). `full`: with "ok" always, with "closed" when the results stay. */
export type AskView = { state: AskState; head: { title_en: string; title_ar: string; opens_at: string | null } | null; full: AskFull | null };
export const ASK_NONE: AskView = { state: "none", head: null, full: null };

const https = (v: unknown): string | null => (typeof v === "string" && /^https:\/\/[^\s"'<>]+$/i.test(v) ? v : null);
const RESULTS: readonly string[] = ["live", "answered", "closed", "staff"];

function questionOf(raw: unknown): AskQuestion | null {
  const q = obj(raw);
  const id = int(q?.id);
  if (!q || id === null || !str(q.kind)) return null;
  return {
    id, pos: num(q.pos) ?? 0, kind: str(q.kind), title_en: str(q.title_en), title_ar: str(q.title_ar), help_en: str(q.help_en), help_ar: str(q.help_ar),
    image: https(q.image), config: obj(q.config) ?? {}, moderated: q.moderated !== false,
    // a rule these pages do not know hides the results, as "staff" does
    results: RESULTS.includes(str(q.results)) ? (q.results as AskResults) : "staff",
    open: q.open !== false, reveal: q.reveal === true, started_at: when(q.started_at), look: lookOf(q.look),
  };
}

function mineOf(raw: unknown): AskMine | null {
  const m = obj(raw);
  const id = int(m?.id);
  if (!m || id === null) return null;
  const status = m.status === "approved" || m.status === "rejected" ? m.status : "pending";
  const value = obj(m.value) ?? {};
  return { id, value, body: str(m.body) || str(value.t), status, answered: m.answered === true, votes: Math.max(0, int(m.votes) ?? 0), created_at: str(m.created_at) };
}
/** The viewer's own answers to one question, as ask_page and ask_send list them. */
export const mineList = (raw: unknown): AskMine[] => list(raw).map(mineOf).filter((m): m is AskMine => m !== null);

function liveOf(raw: unknown): AskLive | null {
  const l = obj(raw);
  if (!l) return null;
  const q: AskLive["q"] = {};
  for (const [id, v] of Object.entries(obj(l.q) ?? {})) {
    const o = obj(v);
    if (o) q[id] = { open: o.open !== false, reveal: o.reveal === true, started_at: when(o.started_at) };
  }
  const stats = obj(l.stats);
  return {
    ver: Math.max(0, num(l.ver) ?? 0), state: l.state === "closed" ? "closed" : "ok", open: l.open !== false, pace: l.pace === "live" ? "live" : "self",
    current_q: int(l.current_q), round: int(l.round) ?? 1, q, results: obj(l.results) ?? {},
    stats: stats ? { answers: Math.max(0, int(stats.answers) ?? 0), people: Math.max(0, int(stats.people) ?? 0) } : null,
  };
}

function fullOf(o: Record<string, unknown>): AskFull | null {
  const p = obj(o.page);
  const id = int(p?.id);
  if (!p || id === null || !askSlugOk(p.slug)) return null;
  const questions = list(o.questions).map(questionOf).filter((q): q is AskQuestion => q !== null).sort((a, b) => a.pos - b.pos || a.id - b.id);
  const mine: Record<string, AskMine[]> = {};
  for (const [qid, rows] of Object.entries(obj(o.mine) ?? {})) mine[qid] = mineList(rows);
  const preview = o.preview === true;
  return {
    signed: o.signed === true, canAnswer: o.can_answer === true && !preview, preview, rk: str(o.rk),
    page: {
      id, slug: p.slug, code: /^\d{6}$/.test(str(p.code)) ? str(p.code) : "", title_en: str(p.title_en), title_ar: str(p.title_ar), intro_en: str(p.intro_en), intro_ar: str(p.intro_ar),
      pace: p.pace === "live" ? "live" : "self", current_q: int(p.current_q), opens_at: when(p.opens_at), closes_at: when(p.closes_at), round: int(p.round) ?? 1, open: p.open !== false, look: lookOf(p.look),
    },
    questions, mine, voted: list(o.voted).map(int).filter((n): n is number => n !== null), live: liveOf(o.live),
  };
}

const headOf = (raw: unknown): AskView["head"] => {
  const p = obj(raw);
  return p && (str(p.title_en).trim() || str(p.title_ar).trim()) ? { title_en: str(p.title_en), title_ar: str(p.title_ar), opens_at: when(p.opens_at) } : null;
};

/** ask_page's answer as the page draws it. Anything that is not one of its states - no answer, a function the
 *  database does not have yet, a page without its questions - is "none". */
export function askView(raw: unknown): AskView {
  const o = obj(raw);
  if (!o) return ASK_NONE;
  switch (o.state) {
    case "ok": {
      const full = fullOf(o);
      return full ? { state: "ok", head: headOf(o.page), full } : ASK_NONE;
    }
    case "closed": {
      const head = headOf(o.page);
      return head ? { state: "closed", head, full: Array.isArray(o.questions) ? fullOf(o) : null } : ASK_NONE;
    }
    case "soon": {
      const head = headOf(o.page);
      return head ? { state: "soon", head, full: null } : ASK_NONE;
    }
    // a page for accounts says nothing of itself to a visitor who is not signed in (contract F)
    case "signin": return { state: "signin", head: null, full: null };
    case "audience": return { state: "audience", head: null, full: null };
    default: return ASK_NONE;
  }
}

/** ask_screen's answer: the page as the big screen draws it, or null for a key the database refused. */
export function askScreen(raw: unknown): AskFull | null {
  const o = obj(raw);
  return o && o.ok === true ? fullOf(o) : null;
}

/** ask_live's answer: the key no longer opens the page (`gone`), nothing changed since the version sent (`same`,
 *  which still says whether the page is open: a page closes by the clock with no change of version), or the whole. */
export type LiveAnswer = { kind: "gone" } | { kind: "same"; ver: number; state: "ok" | "closed" | null; open: boolean | null } | { kind: "full"; live: AskLive };
export function askLive(raw: unknown): LiveAnswer {
  const o = obj(raw);
  if (!o || o.ok !== true) return { kind: "gone" };
  if (o.same === true) return { kind: "same", ver: Math.max(0, num(o.ver) ?? 0), state: o.state === "closed" ? "closed" : o.state === "ok" ? "ok" : null, open: typeof o.open === "boolean" ? o.open : null };
  const live = liveOf(o);
  return live ? { kind: "full", live } : { kind: "gone" };
}

/** ask_send's answer: taken (with the viewer's answers to that question when the database lists them; `repeat` when
 *  the same words were sent again and nothing new was stored), or why not. */
export type SendAnswer = { ok: true; status: "pending" | "approved"; repeat: boolean; mine: AskMine[] | null } | { ok: false; error: AskError };
export function askSent(raw: unknown): SendAnswer {
  const o = obj(raw);
  if (!o) return { ok: false, error: "generic" };
  if (o.ok !== true) return { ok: false, error: askErrorKey(o.error) };
  return { ok: true, status: o.status === "approved" ? "approved" : "pending", repeat: o.repeat === true, mine: Array.isArray(o.mine) ? mineList(o.mine) : null };
}

/* ------------------------------------------------------------------ the page as it changes */

/** A live answer taken into the page: each question's open and reveal, the page's state, the results. `reload`: the
 *  page itself must be read again - staff put a question on screen that it does not hold, or started a new round (the
 *  viewer's own answers are the old round's). A version older than the page's is dropped (`ver` only ever grows). */
export function applyLive(full: AskFull, live: AskLive): { full: AskFull; reload: boolean } {
  if (full.live && live.ver < full.live.ver) return { full, reload: false };
  const held = new Set(full.questions.map((q) => String(q.id)));
  const reload = Object.keys(live.q).some((id) => !held.has(id)) || live.round !== full.page.round;
  const questions = full.questions.map((q) => {
    const now = live.q[String(q.id)];
    return now && (now.open !== q.open || now.reveal !== q.reveal || now.started_at !== q.started_at) ? { ...q, ...now } : q;
  });
  return { full: { ...full, questions, live, page: { ...full.page, open: live.open && live.state === "ok", current_q: live.current_q, pace: live.pace } }, reload };
}

/** An unchanged poll's news: whether the page is still open. */
export function applySame(full: AskFull, same: { state: "ok" | "closed" | null; open: boolean | null }): AskFull {
  if (!full.live || same.state === null || same.open === null) return full;
  if (full.live.state === same.state && full.live.open === same.open) return full;
  return { ...full, live: { ...full.live, state: same.state, open: same.open }, page: { ...full.page, open: same.open && same.state === "ok" } };
}

/** Whether the page takes answers now: open as first read, and still open by the last poll. */
export const pageOpen = (full: AskFull): boolean => full.page.open && (!full.live || (full.live.open && full.live.state === "ok"));

/** What stands where a question's answer goes:
 *  - "none": nothing (an info slide, a kind these pages do not draw, a preview, a closed page with no answer of theirs);
 *  - "signin": the page takes answers but the viewer is signed out - one "Sign in to answer" button;
 *  - "open": the form;
 *  - "change": the form, filled with their answer, which sending again replaces (choice with `change`);
 *  - "full": every answer a person may send is sent (written kinds: `per_person`) - the form is gone;
 *  - "done": their one answer, shown in the form, locked;
 *  - "shut": the question or the page stopped taking answers - their answer locked if they gave one, else nothing. */
export type AnswerState = "none" | "signin" | "open" | "change" | "full" | "done" | "shut";
export function answerState(q: AskQuestion, full: AskFull): AnswerState {
  if (q.kind === "info" || !isDrawn(q.kind) || full.preview) return "none";
  const mine = full.mine[String(q.id)] ?? [];
  const taking = pageOpen(full) && q.open;
  if (!taking) return mine.length && !isWritten(q.kind) ? "shut" : "none";
  if (!full.signed || !full.canAnswer) return full.signed ? "none" : "signin";
  if (isWritten(q.kind)) {
    // an answer staff did not approve leaves its place free here; the database has the last word ("limit")
    const counted = mine.filter((m) => m.status !== "rejected").length;
    return counted >= writtenConfig(q.kind, q.config).perPerson ? "full" : "open";
  }
  if (!mine.length) return "open";
  return q.kind === "choice" && choiceConfig(q.config).change ? "change" : "done";
}

/** Whether a question's results are drawn for this viewer (the database sends only those riders may see; this is the
 *  one rule left to the page): never for "staff"; for "answered" once the viewer has an answer on the question - or
 *  once nobody can answer it any more, so a closed page still shows them. The big screen has no viewer: it draws
 *  whatever the database sends. */
export function resultsShown(q: AskQuestion, full: AskFull, screen = false): boolean {
  if (q.kind === "info" || !isDrawn(q.kind) || q.results === "staff") return false;
  if (q.results !== "answered" || screen) return true;
  return (full.mine[String(q.id)] ?? []).length > 0 || !(pageOpen(full) && q.open);
}

/** The viewer's answers to one question, as ask_send lists them after an answer. */
export const withMine = (full: AskFull, question: number, mine: AskMine[]): AskFull => ({ ...full, mine: { ...full.mine, [String(question)]: mine } });

/** One of the viewer's waiting answers taken back (ask_unsend). */
export function withoutMine(full: AskFull, question: number, answer: number): AskFull {
  const rows = full.mine[String(question)] ?? [];
  return rows.some((m) => m.id === answer) ? withMine(full, question, rows.filter((m) => m.id !== answer)) : full;
}

/** The viewer's upvote given or taken back (ask_vote answered `votes`): the answer's count in the results on the
 *  page, and the list of answers they upvoted. The next poll brings the database's own. */
export function withVote(full: AskFull, question: number, answer: number, on: boolean, votes: number | null): AskFull {
  const voted = on ? [...new Set([...full.voted, answer])] : full.voted.filter((id) => id !== answer);
  const result = obj(full.live?.results[String(question)]);
  if (!full.live || !result || !Array.isArray(result.items)) return { ...full, voted };
  const was = full.voted.includes(answer);
  const items = result.items.map((x) => {
    const o = obj(x);
    if (!o || int(o.id) !== answer) return x;
    const v = votes ?? Math.max(0, (int(o.v) ?? 0) + (on === was ? 0 : on ? 1 : -1));
    return { ...o, v };
  });
  return { ...full, voted, live: { ...full.live, results: { ...full.live.results, [String(question)]: { ...result, items } } } };
}

/** The viewer has an answer waiting for approval somewhere on the page. */
export const hasPending = (full: AskFull): boolean => Object.values(full.mine).some((rows) => rows.some((m) => m.status === "pending"));

/* ------------------------------------------------------------------ when to ask again */

/** Between two ask_live calls: a page every 10 s, the big screen every 4. */
export const POLL_MS = { page: 10_000, screen: 4_000 } as const;
/** The page itself is read again (GET /api/ask/<slug>) at most this often when a poll says a waiting answer may have
 *  been reviewed. */
export const REREAD_MS = 30_000;
/** How long to wait before the next ask_live: the pace, doubled for every failed try in a row - two minutes at most
 *  on a page, one on the big screen. */
export function pollDelay(mode: keyof typeof POLL_MS, fails: number): number {
  const most = mode === "screen" ? 60_000 : 120_000;
  return Math.min(most, POLL_MS[mode] * 2 ** clamp(Math.floor(fails) || 0, 0, 8));
}
/** Whether the page may be read again now, having last been read at `lastAt`. */
export const rereadDue = (lastAt: number, now: number): boolean => now - lastAt >= REREAD_MS;

/* ------------------------------------------------------------------ results, shaped for their charts */

export type CloudResult = { n: number; people: number; words: { w: string; n: number }[] };
export function cloudResult(raw: unknown): CloudResult {
  const r = obj(raw) ?? {};
  // each word once: the same text sent twice over is one word, counted together
  const seen = new Map<string, { w: string; n: number }>();
  for (const x of list(r.words)) {
    const o = obj(x);
    const w = str(o?.w).trim(), n = int(o?.n) ?? 0;
    if (!w || n <= 0) continue;
    const had = seen.get(w);
    if (had) had.n += n; else seen.set(w, { w, n });
  }
  const words = [...seen.values()];
  return { n: Math.max(0, int(r.n) ?? words.reduce((a, x) => a + x.n, 0)), people: Math.max(0, int(r.people) ?? 0), words: words.slice(0, 150) };
}

export type AskItem = { id: number; t: string; v: number; a: boolean };
/** Open answers and Q&A: the texts with their votes. Q&A reads unanswered first, the most voted first among them. */
export function itemsResult(kind: string, raw: unknown): { n: number; items: AskItem[] } {
  const r = obj(raw) ?? {};
  const items: AskItem[] = [];
  for (const x of list(r.items)) {
    const o = obj(x);
    const id = int(o?.id);
    if (o && id !== null && str(o.t).trim()) items.push({ id, t: str(o.t).trim(), v: Math.max(0, int(o.v) ?? 0), a: o.a === true });
  }
  const sorted = kind === "qa" ? items.map((x, i) => ({ x, i })).sort((p, q) => Number(p.x.a) - Number(q.x.a) || q.x.v - p.x.v || p.i - q.i).map(({ x }) => x) : items;
  return { n: Math.max(0, int(r.n) ?? items.length), items: sorted.slice(0, 100) };
}

export type BarRow = { id: string; label: string; n: number; share: number; correct: boolean };
/** Multiple choice: every option in the order staff wrote them, with how many picked it and their share of the
 *  people who answered. */
export function choiceRows(config: unknown, raw: unknown, locale: string): { n: number; rows: BarRow[] } {
  const r = obj(raw) ?? {};
  const counts = obj(r.counts) ?? {};
  const correct = list(r.correct);
  const options = optionsOf(config);
  const each = options.map((o) => Math.max(0, int(counts[o.id]) ?? 0));
  // the people who answered; never fewer than the most picked option
  const n = Math.max(int(r.n) ?? 0, ...each, 0);
  return { n, rows: options.map((o, i) => ({ id: o.id, label: optionText(locale, o), n: each[i], share: n ? each[i] / n : 0, correct: correct.includes(o.id) })) };
}

export type ScaleRow = { id: string; label: string; avg: number | null; at: number; dist: number[]; most: number };
/** Scales: every statement with its average (and where it falls on the min-max track, 0 to 1) and how many gave each mark. */
export function scaleRows(config: unknown, raw: unknown, locale: string): { n: number; min: number; max: number; rows: ScaleRow[] } {
  const c = scalesConfig(config);
  const r = obj(raw) ?? {};
  const avg = obj(r.avg) ?? {}, dist = obj(r.dist) ?? {};
  const marks = c.max - c.min + 1;
  const rows = c.options.map((o) => {
    const a = num(avg[o.id]);
    const d = Array.from({ length: marks }, (_, i) => Math.max(0, int(list(dist[o.id])[i]) ?? 0));
    const mean = a !== null ? clamp(a, c.min, c.max) : null;
    return { id: o.id, label: optionText(locale, o), avg: mean, at: mean === null ? 0 : (mean - c.min) / (c.max - c.min), dist: d, most: Math.max(...d, 0) };
  });
  return { n: Math.max(0, int(r.n) ?? 0), min: c.min, max: c.max, rows };
}

export type RankRow = { id: string; label: string; score: number; place: number | null; share: number };
/** Ranking: the options by score, the best first (a tie: the better average place, then the order staff wrote). */
export function rankRows(config: unknown, raw: unknown, locale: string): { n: number; rows: RankRow[] } {
  const r = obj(raw) ?? {};
  const score = obj(r.score) ?? {}, pos = obj(r.pos) ?? {};
  const rows = optionsOf(config).map((o, i) => ({ i, id: o.id, label: optionText(locale, o), score: Math.max(0, num(score[o.id]) ?? 0), place: num(pos[o.id]) }));
  const top = Math.max(...rows.map((x) => x.score), 0);
  rows.sort((a, b) => b.score - a.score || (a.place ?? Infinity) - (b.place ?? Infinity) || a.i - b.i);
  return { n: Math.max(0, int(r.n) ?? 0), rows: rows.map(({ id, label, score: s, place }) => ({ id, label, score: s, place, share: top ? s / top : 0 })) };
}

export type PointRow = { id: string; label: string; avg: number; sum: number; share: number };
/** Points: the options by their average, the most first; `share` is the average's part of the points a person has. */
export function pointRows(config: unknown, raw: unknown, locale: string): { n: number; total: number; rows: PointRow[] } {
  const c = pointsConfig(config);
  const r = obj(raw) ?? {};
  const avg = obj(r.avg) ?? {}, sum = obj(r.sum) ?? {};
  const rows = c.options.map((o, i) => ({ i, id: o.id, label: optionText(locale, o), avg: Math.max(0, num(avg[o.id]) ?? 0), sum: Math.max(0, num(sum[o.id]) ?? 0) }));
  rows.sort((a, b) => b.avg - a.avg || a.i - b.i);
  return { n: Math.max(0, int(r.n) ?? 0), total: c.total, rows: rows.map(({ id, label, avg: a, sum: s }) => ({ id, label, avg: a, sum: s, share: clamp(a / c.total, 0, 1) })) };
}

export type NumberBin = { lo: number; hi: number; n: number };
export type NumberResult = { n: number; avg: number | null; min: number | null; max: number | null; bins: NumberBin[]; most: number; correct: number | null };
/** A number: the average, the least and the most given, and the bins of its histogram. */
export function numberResult(raw: unknown): NumberResult {
  const r = obj(raw) ?? {};
  const bins: NumberBin[] = [];
  for (const x of list(r.bins)) {
    const o = obj(x);
    const lo = num(o?.lo), hi = num(o?.hi);
    if (o && lo !== null && hi !== null) bins.push({ lo, hi, n: Math.max(0, int(o.n) ?? 0) });
  }
  return { n: Math.max(0, int(r.n) ?? 0), avg: num(r.avg), min: num(r.min), max: num(r.max), bins: bins.slice(0, 40), most: Math.max(...bins.map((b) => b.n), 0), correct: num(r.correct) };
}

/* ------------------------------------------------------------------ the big screen */

/** The question the big screen shows: the one its operator moved to; else, on a page staff pace, the one they put on
 *  screen; else the one the address names (?q=<id>); else the first. An index into `questions`, -1 when there is none. */
export function screenAt(questions: readonly AskQuestion[], o: { picked: number | null; pace: "self" | "live"; current: number | null; asked: string | null }): number {
  const at = (id: number | null) => (id === null ? -1 : questions.findIndex((q) => q.id === id));
  const picked = at(o.picked);
  if (picked >= 0) return picked;
  const current = o.pace === "live" ? at(o.current) : -1;
  if (current >= 0) return current;
  const asked = at(o.asked && /^\d{1,15}$/.test(o.asked) ? Number(o.asked) : null);
  if (asked >= 0) return asked;
  return questions.length ? 0 : -1;
}
/** One question on (1) or back (-1), stopping at the ends. */
export const screenStep = (count: number, at: number, by: 1 | -1): number => (count < 1 ? -1 : clamp(at + by, 0, count - 1));

/* ------------------------------------------------------------------ coming back from creating an account */

/** Creating an account happens in the booking app, which hands the rider back to /api/account/handoff. An Ask page
 *  notes its own address in this cookie as the visitor leaves (sent to that route only, half an hour), so the new
 *  account lands back on the question it came to answer and not on My Account. */
export const ASK_BACK_COOKIE = "mm_ask_back";
export const ASK_BACK_MAX_AGE = 1800;
export const ASK_BACK_PATH = "/api/account/handoff";
/** The address to land on, from the cookie's value: /ask or /ask/<slug>, and nothing else - never an address the
 *  cookie makes up. */
export function askBack(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value;
  try { v = decodeURIComponent(value); } catch { return null; }
  if (v === "/ask") return v;
  const m = /^\/ask\/([a-z0-9-]{3,40})$/.exec(v);
  return m && askSlugOk(m[1]) ? v : null;
}
