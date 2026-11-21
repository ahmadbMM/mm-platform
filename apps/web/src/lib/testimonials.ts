import { intlOf } from "../i18n/locales";
import type { SiteContent } from "./site";

// Testimonials (the user, 2026-11-18: "Create a testimonials page but don't make it visible, People write their
// testimonials on our services & community rides. Then we publish them in a testimonials page"). The database part is the
// booking app's migration 20261119120000_testimonials.sql; this file is the website's plain logic, the same on the server
// and in the browser, so it can be tested:
//   - micromobility.sa/testimonials, the published ones (testimonials_public), and /testimonials/write, where a signed-in
//     rider writes one (testimonial_mine, testimonial_send, testimonial_delete); both open by their link whatever the
//     launch switch says;
//   - ONE launch switch, site_content 'testimonials.on' (an explicit true; anything else is off), which turns on together
//     everything a rider meets without the link: the header's link, the sitemap and search engines, Home's "What riders
//     say" strip fed from the FEATURED ones, My Account's "Write a testimonial" and the ask after a rating of 9 or 10;
//   - a photo is served by the site from its own address (app/api/testimonials/photo/[id]), never its bytes in the page.

export const TM_ON_KEY = "testimonials.on";
/** The launch switch: on only with an explicit true, the way the database's _tm_on() reads it. */
export const testimonialsOn = (content: SiteContent | null | undefined): boolean => content?.[TM_ON_KEY] === true;

/** What a testimonial is about, in the order the form offers them (the database's own values). */
export const TM_ABOUTS = ["saturday", "session", "learn", "event", "workshop", "other"] as const;
export type TmAbout = (typeof TM_ABOUTS)[number];
export const isAbout = (v: unknown): v is TmAbout => typeof v === "string" && (TM_ABOUTS as readonly string[]).includes(v);

export type TmNameMode = "full" | "short" | "anon";
export const TM_NAME_MODES: readonly TmNameMode[] = ["full", "short", "anon"];
export type TmStatus = "pending" | "published" | "rejected" | "hidden";

/** The words: 20 to 800 characters, as the database counts them after cleaning. */
export const TM_BODY_MIN = 20;
export const TM_BODY_MAX = 800;
/** A photo as the database takes it: a JPEG, PNG or WebP picture as a data: URL, 600,000 bytes at most as text. */
export const TM_PHOTO_MAX = 600_000;
/** The longest side a photo is made down to in the browser before it is sent. */
export const TM_PHOTO_SIDE = 1200;
/** The JPEG qualities tried in turn until the photo fits. */
export const TM_PHOTO_QUALITIES = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34] as const;
/** The public page shows this many at a time (testimonials_public's own default). */
export const TM_PAGE = 60;
/** A rating's headline score at or above this asks whether the rider would share it as a testimonial. */
export const TM_ASK_FROM = 9;

export type TmSince = { year: number; rides: number };
/** One published testimonial as the public page and Home show it. `name` is null for an anonymous one. */
export type TmCard = { id: number; about: TmAbout; stars: number | null; body: string; lang: string; name: string | null; since: TmSince | null; photo: boolean; featured: boolean; publishedAt: string | null };
export type TmPublicList = { on: boolean; count: number; rated: number; avg: number | null; byAbout: Partial<Record<TmAbout, number>>; items: TmCard[] };
/** One of the rider's own, whatever its state. */
export type TmMineItem = { id: number; about: TmAbout; stars: number | null; body: string; nameMode: TmNameMode; displayName: string | null; status: TmStatus; photo: boolean; source: string; entryId: string | null; createdAt: string | null; publishedAt: string | null };
/** testimonial_mine's answer as the pages use it: the switch, the two names the rider can choose between exactly as
 *  they would show (null: the account has none for that choice), the "since" line's numbers and their testimonials. */
export type TmMine = { on: boolean; names: { full: string | null; short: string | null }; since: TmSince | null; items: TmMineItem[] };

export const TM_EMPTY: TmPublicList = { on: false, count: 0, rated: 0, avg: null, byAbout: {}, items: [] };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const S = (v: unknown) => (typeof v === "string" ? v : "");
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
/** A whole number from JSON (a bigint may come as a string). */
const int = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,15}$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) ? n : null;
};
const count = (v: unknown): number => Math.max(0, int(v) ?? 0);
const starsOf = (v: unknown): number | null => {
  const n = int(v);
  return n !== null && n >= 1 && n <= 5 ? n : null;
};

/** The "since" line's numbers, or null when there is no year to say. */
export function tmSince(v: unknown): TmSince | null {
  if (!isObj(v)) return null;
  const year = int(v.year);
  if (year === null || year < 2000 || year > 2200) return null;
  return { year, rides: count(v.rides) };
}

function card(v: unknown): TmCard | null {
  if (!isObj(v)) return null;
  const id = int(v.id);
  const body = S(v.body);
  if (id === null || id <= 0 || !body.trim() || !isAbout(v.about)) return null;
  const name = str(v.name);
  return {
    id, about: v.about, stars: starsOf(v.stars), body, lang: /^[a-z]{2}$/.test(S(v.lang)) ? S(v.lang) : "en",
    name, since: name ? tmSince(v.since) : null, photo: v.photo === true, featured: v.featured === true, publishedAt: str(v.published_at),
  };
}

/** testimonials_public's answer, read safely: anything it cannot use is left out; no answer at all is the empty list. */
export function tmPublic(raw: unknown): TmPublicList {
  if (!isObj(raw)) return TM_EMPTY;
  const avgN = typeof raw.avg === "number" ? raw.avg : typeof raw.avg === "string" && raw.avg.trim() ? Number(raw.avg) : NaN;
  const byAbout: Partial<Record<TmAbout, number>> = {};
  if (isObj(raw.by_about)) for (const a of TM_ABOUTS) { const n = count(raw.by_about[a]); if (n > 0) byAbout[a] = n; }
  const items = (Array.isArray(raw.items) ? raw.items : []).map(card).filter((x): x is TmCard => x !== null);
  return {
    on: raw.on === true, count: count(raw.count), rated: count(raw.rated),
    avg: Number.isFinite(avgN) && avgN >= 1 && avgN <= 5 ? Math.round(avgN * 10) / 10 : null,
    byAbout, items,
  };
}

const STATUSES: readonly TmStatus[] = ["pending", "published", "rejected", "hidden"];
function mineItem(v: unknown): TmMineItem | null {
  if (!isObj(v)) return null;
  const id = int(v.id);
  if (id === null || id <= 0 || !isAbout(v.about) || !STATUSES.includes(v.status as TmStatus)) return null;
  const mode = TM_NAME_MODES.includes(v.name_mode as TmNameMode) ? (v.name_mode as TmNameMode) : "anon";
  return {
    id, about: v.about, stars: starsOf(v.stars), body: S(v.body), nameMode: mode, displayName: mode === "anon" ? null : str(v.display_name),
    status: v.status as TmStatus, photo: v.photo === true, source: S(v.source), entryId: str(v.entry_id), createdAt: str(v.created_at), publishedAt: str(v.published_at),
  };
}

/** testimonial_mine's answer when it is {ok: true, ...}; null for anything else (a refusal says why: tmRefusal). The
 *  one-time ask about an old comment is read on its own (tmOldAsk). */
export function tmMine(raw: unknown): TmMine | null {
  if (!isObj(raw) || raw.ok !== true) return null;
  const names = isObj(raw.names) ? raw.names : {};
  return {
    on: raw.on === true,
    names: { full: str(names.full)?.trim() ?? null, short: str(names.short)?.trim() ?? null },
    since: tmSince(raw.since),
    items: (Array.isArray(raw.items) ? raw.items : []).map(mineItem).filter((x): x is TmMineItem => x !== null),
  };
}

/** The one-time ask about an old comment (the booking app's rider-testimonial.js _tstAskRun, dfbfba44, fbd39da1): a done
 *  ride rated 9 or 10 before the switch was last turned on, with 40 characters or more written, not yet a testimonial,
 *  for an account that never answered the ask. testimonial_mine names it in `ask` while the switch is on and one is due;
 *  null for none (or anything it cannot use). */
export type TmOldAsk = { entry: string; body: string; date: string | null; about: TmAbout; title: string | null; titleAr: string | null };
export function tmOldAsk(raw: unknown): TmOldAsk | null {
  if (!isObj(raw) || raw.ok !== true || raw.on !== true || !isObj(raw.ask)) return null;
  const a = raw.ask, entry = S(a.entry_id), body = S(a.body).trim();
  if (!ENTRY.test(entry) || !body) return null;
  const date = /^\d{4}-\d{2}-\d{2}/.test(S(a.date)) ? S(a.date).slice(0, 10) : null;
  return { entry, body, date, about: isAbout(a.about) ? a.about : "other", title: str(a.title)?.trim() ?? null, titleAr: str(a.title_ar)?.trim() ?? null };
}
/** What the ask names the ride by: its title (the Arabic one on the Arabic page), else - an untitled ride, every Saturday
 *  and most sessions - its kind (294f2348), never "Something else". */
export function tmAskTitle(a: TmOldAsk, locale: string, about: Record<string, string>): string {
  return (locale === "ar" && a.titleAr) || a.title || (a.about !== "other" ? about[a.about] ?? "" : "");
}
/** An answer to the ask as a page posts it ({entry, yes, nameMode, consent}), read into testimonial_old_answer's
 *  arguments (without the account's id and token); null when it cannot be one. A no sends no name and no tick. */
export function tmOldArgs(b: unknown): Record<string, unknown> | null {
  if (!isObj(b) || typeof b.entry !== "string" || !ENTRY.test(b.entry) || typeof b.yes !== "boolean") return null;
  const mode = TM_NAME_MODES.includes(b.nameMode as TmNameMode) ? (b.nameMode as TmNameMode) : null;
  if (b.yes && !mode) return null;
  return { p_entry: b.entry, p_yes: b.yes, p_name_mode: mode ?? "short", p_consent: b.yes && b.consent === true };
}
/** The ask's answer that ends it for good: taken, answered before ("done"), the ride no longer due ("entry"), or the switch
 *  gone off ("off"). */
export const tmOldEnded = (v: unknown): boolean => isObj(v) && (v.ok === true || (v.ok === false && ["done", "entry", "off"].includes(S(v.error))));

/** The error codes the rider's functions answer (the contract), and the site's own: "busy" (the minute's requests),
 *  "absent" (a database without the functions yet), "origin", "generic". Anything else reads as "generic". */
export const TM_ERRORS = ["signin", "consent", "invalid", "body", "link", "stars", "about", "name", "photo", "entry", "dup", "limit", "throttled", "gone", "busy", "absent", "generic"] as const;
export type TmError = (typeof TM_ERRORS)[number];
export const tmError = (v: unknown): TmError => (TM_ERRORS as readonly string[]).includes(v as string) ? (v as TmError) : "generic";
/** A function's own refusal, {ok: false, error: <code>}; null when it is not one. */
export const tmRefusal = (v: unknown): TmError | null => (isObj(v) && v.ok === false ? tmError(v.error) : null);

/** The status as the rider is told it: rejected and hidden both read as "Not published". */
export const tmStatusWord = (s: TmStatus): "waiting" | "published" | "not" => (s === "pending" ? "waiting" : s === "published" ? "published" : "not");

/** The "since" line in the page's words: "Rider since 2025 · 12 rides", "Rider since 2025 · 1 ride", or with no ride done
 *  yet "Rider since 2025"; null with no year. Only a named testimonial has one (the database leaves it off the others). */
export type SinceWords = { since: (year: number) => string; sinceOne: (year: number) => string; sinceMany: (year: number, rides: number) => string };
export function sinceText(since: TmSince | null, w: SinceWords): string | null {
  if (!since) return null;
  return since.rides > 1 ? w.sinceMany(since.year, since.rides) : since.rides === 1 ? w.sinceOne(since.year) : w.since(since.year);
}

/** The name a card shows: the one the rider chose, frozen as they saw it, or "A MicroMobility rider". */
export const tmName = (c: { name: string | null }, anon: string): string => c.name?.trim() || anon;

/** The featured testimonials as Home's "What riders say" strip draws them (components/home/ReviewsStrip.tsx), after any
 *  review staff typed in: the name the rider chose (or "A MicroMobility rider"), under it the "since" line, else what it
 *  is about, the words as written and the stars. */
export type StripWords = SinceWords & { anon: string; about: Record<string, string>; starsOf: (n: string) => string };
export function tmStripItems(cards: TmCard[], w: StripWords): Array<{ name: string; role: string; quote: string; stars: number | null; starsLabel: string; own: true }> {
  return cards.map((c) => ({
    name: tmName(c, w.anon), role: sinceText(c.since, w) ?? w.about[c.about] ?? "", quote: c.body,
    stars: c.stars, starsLabel: c.stars !== null ? w.starsOf(String(c.stars)) : "", own: true as const,
  }));
}

/** The average stars with one decimal, Latin digits in every language and the language's own decimal mark. */
export function tmAvg(avg: number, locale: string): string {
  return avg.toLocaleString(locale === "en" ? "en-US" : intlOf(locale), { numberingSystem: "latn", minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** The stars drawn for a value: each star full, half or empty ("full" from x.75, "half" from x.25). */
export function starFills(value: number): Array<"full" | "half" | "none"> {
  return [1, 2, 3, 4, 5].map((i) => (value >= i - 0.25 ? "full" : value >= i - 0.75 ? "half" : "none"));
}

/** A rating's headline score (1-10) as stars (1-5): halved and rounded, as the database does for an old comment
 *  (9 and 10 are 5). */
export const tmStarsFromScore = (score: number): number => Math.max(1, Math.min(5, Math.round(score / 2)));

/** What a booking was, as the database's _tm_about reads it, from the session's kind as the site names it (lib/rides.ts
 *  rideKind): the Saturday ride, a workshop, a session at the circuit (rentals, JCC), else an event; no session, other. */
export function tmAboutOfKind(kind: string | null | undefined): TmAbout {
  if (!kind) return "other";
  return kind === "saturday" ? "saturday" : kind === "workshop" ? "workshop" : kind === "jcc" ? "session" : "event";
}

/** The public page's filter (?about=) and page (?page=, from 1). */
export const tmAboutParam = (v: unknown): TmAbout | null => {
  const s = Array.isArray(v) ? v[0] : v;
  return isAbout(s) ? s : null;
};
export function tmPageParam(v: unknown): number {
  const s = Array.isArray(v) ? v[0] : v;
  const n = typeof s === "string" && /^\d{1,3}$/.test(s) ? Number(s) : 1;
  return n >= 1 && n <= 500 ? n : 1;
}
/** How many a filter holds, for the pager: every published one, or that kind's. */
export const tmTotal = (list: TmPublicList, about: TmAbout | null): number => (about ? list.byAbout[about] ?? 0 : list.count);
/** The kinds the pills offer: only those with any published, in the form's order; none when fewer than two have any
 *  (a filter that changes nothing is no filter). */
export function tmPills(list: TmPublicList): TmAbout[] {
  const have = TM_ABOUTS.filter((a) => (list.byAbout[a] ?? 0) > 0);
  return have.length >= 2 ? have : [];
}
/** The public page's address for a filter and a page. */
export function tmHref(about: TmAbout | null, page = 1): string {
  const q = new URLSearchParams();
  if (about) q.set("about", about);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return `/testimonials${s ? `?${s}` : ""}`;
}

/** The addresses the sitemap lists for testimonials: the public page, only while the switch is on. */
export const tmSitemapPaths = (content: SiteContent | null | undefined): string[] => (testimonialsOn(content) ? ["/testimonials"] : []);

/** A photo's own address on this site (the cards' <img>). */
export const tmPhotoSrc = (id: number): string => `/api/testimonials/photo/${id}`;

/** A testimonial's photo as the database holds it, as bytes to serve: its type and the decoded picture; null for
 *  anything that is not a JPEG, PNG or WebP data: URL. */
export function tmPhotoBytes(v: unknown): { type: string; bytes: Uint8Array<ArrayBuffer> } | null {
  if (typeof v !== "string" || v.length > TM_PHOTO_MAX) return null;
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(v);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.length ? { type: m[1], bytes } : null;
  } catch {
    return null;
  }
}

/** A picture's size once made down to fit TM_PHOTO_SIDE on its longest side (never made larger). */
export function tmFit(w: number, h: number, side: number = TM_PHOTO_SIDE): { w: number; h: number } {
  const k = Math.min(1, side / Math.max(w, h, 1));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/** The first of the JPEG data: URLs a picture is drawn at (the qualities in turn) that fits TM_PHOTO_MAX; null when even
 *  the lowest does not. `draw(q)` is the canvas's toDataURL("image/jpeg", q). */
export function tmFitQuality(draw: (q: number) => string, max: number = TM_PHOTO_MAX): string | null {
  for (const q of TM_PHOTO_QUALITIES) {
    const u = draw(q);
    if (u.length <= max && /^data:image\/jpeg;base64,/.test(u)) return u;
  }
  return null;
}

const ENTRY = /^[A-Za-z0-9_-]{1,64}$/;
/** The language a testimonial is written in, as the page sends it: one of two letters, else English. */
export const tmLang = (v: unknown): string => (typeof v === "string" && /^[a-z]{2}$/.test(v) ? v : "en");

/** A send as a page posts it ({body, stars, about, nameMode, consent, photo?, source, entry?, lang}), read safely into
 *  testimonial_send's arguments (without the account's id and token); null when it cannot be one at all. Everything
 *  else - the words' length after cleaning, a link in them, the stars, the name the account has, the photo, the booking
 *  - the database checks and answers with its own code. Only the website's two sources are taken: 'web' (the form) and
 *  'rating' (the ask after a rating, which names its booking); 'app' is the booking app's. */
export function tmSendArgs(b: unknown): Record<string, unknown> | null {
  if (!isObj(b)) return null;
  if (typeof b.body !== "string" || b.body.length > 4000) return null;
  if (b.stars !== null && b.stars !== undefined && !(typeof b.stars === "number" && Number.isInteger(b.stars))) return null;
  if (typeof b.about !== "string" || b.about.length > 20) return null;
  if (typeof b.nameMode !== "string" || b.nameMode.length > 10) return null;
  if (b.source !== "web" && b.source !== "rating") return null;
  if (b.photo != null && (typeof b.photo !== "string" || b.photo.length > TM_PHOTO_MAX)) return null;
  const entry = b.source === "rating" ? (typeof b.entry === "string" && ENTRY.test(b.entry) ? b.entry : null) : null;
  if (b.source === "rating" && !entry) return null;
  return {
    p_body: b.body, p_stars: typeof b.stars === "number" ? b.stars : null, p_about: b.about, p_name_mode: b.nameMode,
    p_consent: b.consent === true, p_photo: typeof b.photo === "string" && b.photo ? b.photo : null,
    p_source: b.source, p_entry: entry, p_lang: tmLang(b.lang),
  };
}

/** A testimonial's id in a request: a whole number above zero. */
export const tmId = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : null);
