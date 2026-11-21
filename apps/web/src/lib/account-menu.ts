// My Account as the booking app's menu and its small pages (the user, 2026-11-19: "i want the account page to be very
// similar on main for it on booking app"; the app's ACC_PAGES, _accRowsPaint and _accMiss, 2026-11-10). The addresses,
// what each row says on its right, and what of a page's fields the profile lacks - kept apart from the page
// (app/[locale]/account/[[...part]]/page.tsx) so they can be tested.
//   /account                 the menu (on a wide screen Personal details beside it)
//   /account/stats, /badges  the record, as before
//   /account/<page>          one small page, with its own Save
import type { AccWords } from "@/components/account/AccountMenu.words";

export type AccView = "account" | "stats" | "badges";
/** The pages, by the booking app's ids (ACC_PAGES), and the website's own: workshop (its appointments), calendar (the
 *  calendar address, the app's Settings row), password and language (the app's two Settings pop-ups), learn (the app's
 *  Learn to ride, a pop-up from its menu row there). Notifications holds Ride news and the way to Updates (2026-11-19). */
export const ACC_PAGES = ["personal", "contact", "residence", "emergency", "riding", "sport", "about", "wallet", "invite", "ambassador",
  "volunteer", "purchases", "workshop", "company", "learn", "notifications", "updates", "calendar", "language", "password", "delete"] as const;
export type AccPage = (typeof ACC_PAGES)[number];
/** The page a wide screen shows beside the menu when none is picked (the app's _accDefPg). */
export const ACC_DEFAULT_PAGE: AccPage = "personal";

/** The view and page an /account address names, or null (not a page: 404). */
export function accountRoute(seg: string[] | undefined): { view: AccView; page: AccPage | null } | null {
  if (!seg || seg.length === 0) return { view: "account", page: null };
  if (seg.length !== 1) return null;
  const s = seg[0];
  if (s === "stats" || s === "badges") return { view: s, page: null };
  return (ACC_PAGES as readonly string[]).includes(s) ? { view: "account", page: s as AccPage } : null;
}
export const accHref = (to: AccView | AccPage): string => (to === "account" ? "/account" : `/account/${to}`);

/** The titles of the pages whose words are not the menu's own (Calendar.words, Notify.words, LearnLadder.words). */
export type PageTitles = { calendar: string; notifications: string; updates: string; learn: string };
/** A page's title, as its row and its heading say it. */
export function pageTitle(p: AccPage, w: AccWords, extra: PageTitles): string {
  switch (p) {
    case "delete": return w.del;
    case "calendar": case "notifications": case "updates": case "learn": return extra[p];
    default: return w[p];
  }
}
/** The page a page's Back leads to: Updates opens from Notifications (the app's Back returns there); every other page's
 *  is the menu. */
export const parentOf = (p: AccPage): AccPage | null => (p === "updates" ? "notifications" : null);

// ── What a page lacks (the app's _accMiss: the fields of Race Ready) ─────────────────────────────────────────────────
export type ProfileLike = Record<string, unknown> | null | undefined;
export type MissKey = "photo" | "name" | "birth_date" | "email" | "phone" | "country" | "city" | "type_preference" | "height";
const MISS_WORD: Record<MissKey, keyof AccWords> = {
  photo: "photo", name: "mName", birth_date: "birth", email: "email", phone: "phone", country: "country", city: "city", type_preference: "bikeType", height: "height",
};
/** A label inside "Add …": lower case where the script has cases and the language starts a phrase so (the app's _lcLabel). */
export function lcLabel(l: string, locale: string): string {
  if (locale === "en") return l.toLowerCase();
  if (["fr", "es", "pt", "tl", "id", "ms", "ru"].includes(locale)) return l.charAt(0).toLowerCase() + l.slice(1);
  return l;
}
const filled = (p: ProfileLike, k: MissKey) => {
  const v = p?.[k];
  if (k === "type_preference") return typeof v === "string" && !!v && v !== "Any";
  return v !== null && v !== undefined && String(v).trim() !== "";
};
/** The fields of `keys` the profile lacks, in order. */
export const missing = (p: ProfileLike, keys: readonly MissKey[]): MissKey[] => keys.filter((k) => !filled(p, k));

/** A list in the reader's language ("photo and birth date"). */
export function listJoin(items: string[], locale: string): string {
  if (items.length < 2) return items[0] ?? "";
  try { return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items); } catch { return items.join(", "); }
}

/** A row's value: what it holds, or what it lacks in amber ("Add profile photo"). */
export type RowValue = { text: string; add: boolean; ltr?: boolean };
export function missValue(p: ProfileLike, keys: readonly MissKey[], w: AccWords, locale: string): RowValue | null {
  const m = missing(p, keys);
  if (!m.length) return null;
  return { text: w.addX.replace("{0}", listJoin(m.map((k) => lcLabel(w[MISS_WORD[k]], locale)), locale)), add: true };
}

/** The bike type's name, as the Riding pills say it. */
export function typeWord(t: string | null | undefined, w: AccWords): string {
  switch (t) {
    case "Road": return w.tRoad; case "Hybrid": return w.tHybrid; case "Mountain": return w.tMountain; case "Kids": return w.tKids;
    case "Road Carbon": return w.tRoadCarbon; case "Own": return w.tOwn; default: return t ?? "";
  }
}

/** The rows of Your details, each with its value or its amber "Add …" (the app's _accRowsPaint). */
export function detailValues(p: ProfileLike, about: { profession?: string | null } | null, w: AccWords, locale: string, cityName: (city: string, country: string) => string) {
  const s = (k: string) => (typeof p?.[k] === "string" ? (p[k] as string) : "");
  return {
    personal: missValue(p, ["photo", "name", "birth_date"], w, locale) ?? { text: s("name"), add: false },
    contact: missValue(p, ["email", "phone"], w, locale) ?? { text: s("phone") || s("email"), add: false, ltr: true },
    residence: missValue(p, ["country", "city"], w, locale) ?? { text: cityName(s("city"), s("country")), add: false },
    riding: missValue(p, ["type_preference", "height"], w, locale) ?? { text: `${typeWord(s("type_preference"), w)} · ${String(p?.height ?? "")} ${w.cm}`, add: false },
    about: { text: about?.profession?.trim() || "", add: false },
  };
}

/** The initials a profile without a photo shows (the app's _accIdHtml). */
export const initialsOf = (name: string) => name.trim().split(/\s+/).filter(Boolean).map((x) => [...x][0] ?? "").join("").slice(0, 2).toLocaleUpperCase();

/** A day as a row's value says it, short: "22 Nov" ("٢٢ نوفمبر" never: Latin digits, the site's rule). */
export function shortDay(iso: string, intl: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  try { return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone: "UTC", numberingSystem: "latn" }).format(new Date(`${iso}T12:00:00Z`)); } catch { return iso; }
}
