import { intlOf } from "@/i18n/locales";
import {
  MK_FACT_KEYS, MK_HOME, MK_PAGE, MK_PRICE_MAX, MK_PRICE_MIN, MK_RULES, isMkCity, isMkCondition, isMkSellerKind, isMkSort, listingHref,
  mkClean, mkPick, mkSports, mkTypesOf, shopHref,
  type MkBrowse, type MkBrowseQuery, type MkCard, type MkCategory, type MkCity, type MkCondition, type MkFactKey, type MkFacts, type MkIndex,
  type MkSearchItem, type MkSellerKind, type MkSort, type MkStatus,
} from "./core";

// Browsing the Marketplace (W1): the plain rules of the browse page, the listing page and the shop page, kept apart
// from their components so they can be tested. Browser-safe: nothing here reads a server. The shapes are the
// database's own (lib/market/core.ts); what is added here is only what the pages need to turn an address into a
// market_browse query and back, and to decide what a page shows.
//
// The browse page's address carries the filters under this file's own names (the contract leaves them to W1):
//   q          the keyword search (80 characters at most, cleaned as the database cleans text)
//   sport      a sport's slug                       type       a product type's slug (it implies its sport)
//   seller     private | shop | company            city       a city key
//   condition  new | excellent | good | fair | parts
//   min, max   the price range, whole riyals       sort       price_asc | price_desc (newest first is the default)
// A value that is not of its shape is left out, as market_browse itself ignores it. Paging is never in the address:
// more results are asked for by the "Show more" button (components/market/w1/more.ts) with the cursor of the page
// before.

/* ------------------------------------------------------------------ the filters */

export type W1Filters = {
  sport: string | null;
  /** A product type's slug (market_browse's `category`). */
  type: string | null;
  seller: MkSellerKind | null;
  city: MkCity | null;
  condition: MkCondition | null;
  min: number | null;
  max: number | null;
  q: string;
  sort: MkSort;
};
export const W1_NONE: W1Filters = { sport: null, type: null, seller: null, city: null, condition: null, min: null, max: null, q: "", sort: "new" };
export const W1_Q_MAX = 80;
/** A page's query as Next hands it over. */
export type W1Search = Record<string, string | string[] | undefined>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
const slug = (v: string): string | null => (v.length >= 2 && v.length <= 60 && SLUG.test(v) ? v : null);
/** A price as the address carries it: digits only, 1 to 500,000. */
export function w1Price(v: unknown): number | null {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = Number(s);
  return n >= MK_PRICE_MIN && n <= MK_PRICE_MAX ? n : null;
}
/** A price as it is typed into the Filters: digits only (Arabic and Persian ones read as Western), six at most. */
export const w1Digits = (v: string): string =>
  v.replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660)).replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0)).replace(/\D/g, "").slice(0, 6);
/** The search words as they are sent: cleaned as the database cleans every text, 80 characters at most. */
export const w1Q = (v: unknown): string => mkClean(v).slice(0, W1_Q_MAX).trim();

/** The filters an address asks for, each checked. `cats`: the visible categories; with them a sport must be a sport
 *  and a type a product type (which also sets its sport), without them (the database did not answer) a slug is taken
 *  as it is and the database ignores what it does not know. A price range written backwards is turned round. */
export function w1FiltersOf(sp: W1Search | null | undefined, cats: readonly MkCategory[]): W1Filters {
  const s = sp ?? {};
  let sport = slug(one(s.sport)), type = slug(one(s.type));
  if (cats.length) {
    const t = type ? cats.find((c) => c.slug === type && c.parent !== null) : undefined;
    type = t ? t.slug : null;
    if (t) sport = t.parent;
    else if (sport && !cats.some((c) => c.slug === sport && c.parent === null)) sport = null;
  }
  const seller = one(s.seller), city = one(s.city), condition = one(s.condition), sort = one(s.sort);
  let min = w1Price(one(s.min)), max = w1Price(one(s.max));
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return {
    sport, type, seller: isMkSellerKind(seller) ? seller : null, city: isMkCity(city) ? city : null,
    condition: isMkCondition(condition) ? condition : null, min, max, q: w1Q(one(s.q)), sort: isMkSort(sort) ? sort : "new",
  };
}
/** A shop's page takes one of them only: the sport. */
export function w1ShopFiltersOf(sp: W1Search | null | undefined, cats: readonly MkCategory[]): W1Filters {
  return { ...W1_NONE, sport: w1FiltersOf({ sport: sp?.sport }, cats).sport };
}

/** What is sent to the server with "Show more" comes back as anything at all: the same checks, from an object. */
export function w1FiltersFrom(v: unknown, cats: readonly MkCategory[]): W1Filters {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const str = (k: string) => (typeof o[k] === "string" ? (o[k] as string) : typeof o[k] === "number" ? String(o[k]) : undefined);
  return w1FiltersOf({ sport: str("sport"), type: str("type"), seller: str("seller"), city: str("city"), condition: str("condition"), min: str("min"), max: str("max"), q: str("q"), sort: str("sort") }, cats);
}

/** market_browse's `p` for these filters. A type goes with its sport, so the answer's `categories` (the product types
 *  of that sport with something on sale) stay the ones the type picker lists. */
export function w1QueryOf(f: W1Filters, extra: { shop?: string; after?: string | null; limit?: number } = {}): MkBrowseQuery {
  const q: MkBrowseQuery = {};
  if (f.sport) q.sport = f.sport;
  if (f.type) q.category = f.type;
  if (f.seller) q.kind = f.seller;
  if (f.city) q.city = f.city;
  if (f.condition) q.condition = f.condition;
  if (f.min !== null) q.price_min = f.min;
  if (f.max !== null) q.price_max = f.max;
  if (f.q) q.q = f.q;
  if (f.sort !== "new") q.sort = f.sort;
  if (extra.shop) q.shop = extra.shop;
  if (extra.after) q.after = extra.after;
  if (extra.limit && extra.limit !== MK_PAGE) q.limit = extra.limit;
  return q;
}

/** The address of these filters under `base` ("/marketplace", or a shop's page): only what is set, always in the same
 *  order, so one set of filters has one address. A type is written without its sport (it implies it). */
export function w1Href(base: string, f: W1Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.type) p.set("type", f.type); else if (f.sport) p.set("sport", f.sport);
  if (f.seller) p.set("seller", f.seller);
  if (f.city) p.set("city", f.city);
  if (f.condition) p.set("condition", f.condition);
  if (f.min !== null) p.set("min", String(f.min));
  if (f.max !== null) p.set("max", String(f.max));
  if (f.sort !== "new") p.set("sort", f.sort);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}
/** One set of filters as one text: what a list of results is keyed by, so a new search starts a new list. */
export const w1Key = (f: W1Filters): string => `${w1Href("", f)}|${f.sport ?? ""}`;

/** The filters with one thing changed. A new sport drops a type that is not one of its own. */
export function w1With(f: W1Filters, patch: Partial<W1Filters>, cats: readonly MkCategory[] = []): W1Filters {
  const next = { ...f, ...patch };
  if ("sport" in patch && !("type" in patch) && next.type) {
    const t = cats.find((c) => c.slug === next.type);
    if (!t || t.parent !== next.sport) next.type = null;
  }
  if (next.min !== null && next.max !== null && next.min > next.max) [next.min, next.max] = [next.max, next.min];
  return next;
}
/** How many of the filters behind the Filters button are set: the product type, the condition, the price range. */
export const w1Further = (f: W1Filters): number => (f.type ? 1 : 0) + (f.condition ? 1 : 0) + (f.min !== null || f.max !== null ? 1 : 0);
/** Whether anything narrows the list (the order does not). */
export const w1Narrowed = (f: W1Filters): boolean => !!(f.sport || f.type || f.seller || f.city || f.condition || f.min !== null || f.max !== null || f.q);

/* ------------------------------------------------------------------ what the pickers offer */

/** The sport chips: the sports with something on sale, in staff's order - and the one picked, so its chip never
 *  vanishes from under the visitor. A sport with nothing to show is not offered. */
export function w1SportChips(cats: readonly MkCategory[], withListings: readonly string[], current: string | null): MkCategory[] {
  return mkSports(cats).filter((s) => withListings.includes(s.slug) || s.slug === current);
}
/** The product types the Filters offer: those of the sport picked that have something on sale (and the one picked).
 *  No sport, no list: a type belongs to a sport, and the sport chips come first. */
export function w1TypeOptions(cats: readonly MkCategory[], f: Pick<W1Filters, "sport" | "type">, withListings: readonly string[]): MkCategory[] {
  if (!f.sport) return [];
  return mkTypesOf(cats, f.sport).filter((t) => withListings.includes(t.slug) || t.slug === f.type);
}

/** Where a search that found nothing can go next, the nearest first: the same sport without its other filters, the
 *  other sports with something on sale (six at most), then everything. Each is a set of filters to link to. */
export type W1Near = { key: string; sport: MkCategory | null; filters: W1Filters };
export function w1Nearby(cats: readonly MkCategory[], f: W1Filters, withListings: readonly string[]): W1Near[] {
  const out: W1Near[] = [];
  const sports = mkSports(cats).filter((s) => withListings.includes(s.slug));
  const own = f.sport ? sports.find((s) => s.slug === f.sport) : undefined;
  const more = !!(f.type || f.seller || f.city || f.condition || f.min !== null || f.max !== null || f.q);
  if (own && more) out.push({ key: `s:${own.slug}`, sport: own, filters: { ...W1_NONE, sport: own.slug } });
  for (const s of sports.filter((x) => x.slug !== f.sport).slice(0, 6)) out.push({ key: `s:${s.slug}`, sport: s, filters: { ...W1_NONE, sport: s.slug } });
  if (w1Narrowed(f) && withListings.length > 0) out.push({ key: "all", sport: null, filters: W1_NONE });
  return out;
}

/* ------------------------------------------------------------------ results kept a minute */

/** The key a browse read may be kept under for a minute (lib/market/w1-server.ts), or null when it is read every
 *  time. Kept: the first page, newest first, of everything, of one sport, of one product type, of one seller kind or
 *  of one shop - a short list of keys that most visits ask for. Never a keyword, a city, a condition, a price range,
 *  another order or a later page: those are as many as people can type. */
export function w1KeptKey(q: MkBrowseQuery): string | null {
  const set = (Object.keys(q) as (keyof MkBrowseQuery)[]).filter((k) => q[k] !== undefined && q[k] !== null && q[k] !== "");
  if (set.some((k) => !["sport", "category", "kind", "shop", "sort", "limit"].includes(k))) return null;
  if ((q.sort ?? "new") !== "new" || (q.limit ?? MK_PAGE) !== MK_PAGE) return null;
  const scopes = (q.sport || q.category ? 1 : 0) + (q.kind ? 1 : 0) + (q.shop ? 1 : 0);
  if (scopes > 1) return null;
  for (const v of [q.sport, q.category, q.shop]) if (v !== undefined && !slug(v)) return null;
  return `${q.sport ?? ""}|${q.category ?? ""}|${q.kind ?? ""}|${q.shop ?? ""}`;
}
/** The most searches kept at once. The keys are few while every slug is one the database vouched for (a visible
 *  category, an approved shop); while the categories cannot be read a sport or a type in an address is taken as
 *  written, so anyone could ask for as many as they can type, and each would stay in the Worker's memory. */
export const W1_KEPT_MAX = 400;
/** Whether a read may be kept under `key`: one already kept, or a new one while there is room (`seen` then holds it).
 *  A search past the limit is read as it is asked, like any search someone typed. */
export function w1MayKeep(seen: Set<string>, key: string, max: number = W1_KEPT_MAX): boolean {
  if (seen.has(key)) return true;
  if (seen.size >= max) return false;
  seen.add(key);
  return true;
}

/* ------------------------------------------------------------------ a listing's page */

/** What a listing's page is, by its state. "sale" and "reserved" are on sale; "sold" is the short while a sold
 *  listing's page still opens for everyone, marked Sold; "private" is a state only its seller is shown (being checked,
 *  removed by staff, expired) - the database answers nothing to anyone else. */
export type W1Stage = "sale" | "reserved" | "sold" | "private";
export const w1Stage = (status: MkStatus): W1Stage => (status === "live" ? "sale" : status === "reserved" ? "reserved" : status === "sold" ? "sold" : "private");
/** Whether search engines may list the page: the Marketplace is open and the listing is one everybody can see. */
export const w1Indexable = (status: MkStatus, on: boolean): boolean => on && w1Stage(status) !== "private";

/** A listing's structured facts as rows, in the form's order: only the ones filled in, each as text. */
export type W1Fact = { key: MkFactKey; value: string };
export function w1Facts(facts: MkFacts | null | undefined): W1Fact[] {
  const f = facts && typeof facts === "object" ? facts : {};
  const out: W1Fact[] = [];
  for (const key of MK_FACT_KEYS) {
    const v = f[key];
    const value = typeof v === "number" && Number.isFinite(v) ? String(v) : typeof v === "string" ? mkClean(v).slice(0, 60) : "";
    if (value) out.push({ key, value });
  }
  return out;
}

/** A date as a page writes it ("20 Nov 2026"), on Riyadh's calendar, in the page's language; null for no date. */
export function w1Date(iso: string | null | undefined, locale: string): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return null;
  try { return new Intl.DateTimeFormat(intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(t); } catch { return null; }
}

/** A long text cut for a search result or a link preview: whole words, `max` characters at most. */
export function w1Cut(text: string | null | undefined, max = 160): string {
  const s = mkClean(text ?? "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s.,;:!?،؛-]+$/, "")}…`;
}

/** A shop's map link, only when it is one of the map addresses the database takes (market_shops.map_url); anything
 *  else is not linked. */
export function w1MapUrl(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length <= 300 && /^https:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.com\/maps|maps\.google\.com)[/?]/.test(s) ? s : null;
}

/* ------------------------------------------------------------------ search */

/** A text as the database matches it (_ask_norm), with its spaces kept: Arabic marks and the tatweel dropped, every
 *  alef as a bare one, the final ya and the ta marbuta as the letters people type instead, lower case. The database
 *  does this itself to a browse search; here it gives the site's own search (the header's) the same forgiveness. */
export function w1Norm(v: string): string {
  return v
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** A text someone wrote, set apart in its own direction where a page draws it as plain text with no place for
 *  dir="auto": a first-strong isolate round it (U+2068 before, U+2069 after), which is what dir="auto" does for an
 *  element. The header's search (components/site/SiteSearch.tsx, not this builder's) draws a result's title as given. */
const FSI = String.fromCharCode(0x2068), PDI = String.fromCharCode(0x2069);
export const w1Own = (text: string): string => `${FSI}${text}${PDI}`;

/** The most listings the header's search is given: it is sent whole to the browser. The Marketplace's own search
 *  (the browse page) looks through every listing. */
export const W1_SEARCH_LISTINGS = 200;

/** market_index as the header's search lists it: one entry per listing on sale (the newest first) and one per
 *  approved shop, each found by its name as written and as the database would match it. A title is what a seller or
 *  a shop wrote, so it is set apart in its own direction (w1Own). */
export function w1SearchItems(index: MkIndex | null, locale: string, words: { listing: string; shop: string }): MkSearchItem[] {
  if (!index) return [];
  const out: MkSearchItem[] = [];
  const found = (...names: (string | null | undefined)[]) => [...new Set(names.filter((n): n is string => !!n).flatMap((n) => [n, w1Norm(n)]))].join(" ");
  for (const s of index.shops) {
    if (!s || typeof s.slug !== "string" || !slug(s.slug) || typeof s.name_en !== "string") continue;
    const title = mkPick(locale, s.name_en, s.name_ar);
    if (title) out.push({ title: w1Own(title), text: words.shop, href: shopHref(s.slug), words: found(s.name_en, s.name_ar) });
  }
  for (const l of index.listings.slice(0, W1_SEARCH_LISTINGS)) {
    if (!l || !Number.isSafeInteger(l.id) || l.id <= 0 || typeof l.title !== "string" || !l.title.trim()) continue;
    out.push({ title: w1Own(l.title), text: words.listing, href: listingHref(l.id), words: w1Norm(l.title) });
  }
  return out;
}

/** The most listings (the newest) and the most shops the sitemap is given. The sitemap writes every address once per
 *  language with all sixteen named beside it (app/sitemap.ts: about 29 KB an address), so the 2,000 listings
 *  market_index can answer would be a 60 MB file, past what a sitemap may be and what a Worker should build. */
export const W1_SITEMAP_LISTINGS = 200;
export const W1_SITEMAP_SHOPS = 200;

/** The Marketplace's addresses for the sitemap: the browse page, the rules, the approved shops and the listings on
 *  sale, the newest first (W1_SITEMAP_LISTINGS at most). Never an account's own pages. With no index (the database did
 *  not answer) the two fixed pages alone. */
export function w1Paths(index: MkIndex | null): string[] {
  const out = [MK_HOME, MK_RULES];
  if (!index) return out;
  for (const s of index.shops.slice(0, W1_SITEMAP_SHOPS)) if (s && typeof s.slug === "string" && slug(s.slug)) out.push(shopHref(s.slug));
  for (const l of index.listings.slice(0, W1_SITEMAP_LISTINGS)) if (l && Number.isSafeInteger(l.id) && l.id > 0) out.push(listingHref(l.id));
  return [...new Set(out)];
}

/** More cards put after the ones on the page, none twice (a listing renewed between two pages can come again). */
export function w1Append<T extends { id: number }>(have: readonly T[], more: readonly T[]): T[] {
  const seen = new Set(have.map((c) => c.id));
  return [...have, ...more.filter((c) => !seen.has(c.id) && (seen.add(c.id), true))];
}

/** The listings shown beside one: the same list without the listing itself, `max` at most. */
export const w1Others = <T extends { id: number }>(items: readonly T[], id: number, max: number): T[] => items.filter((c) => c.id !== id).slice(0, max);

/** A browse answer that is safe to draw from when the read failed. */
export const W1_EMPTY: MkBrowse = { items: [], next: null, sports: [], categories: [] };

/** What "Show more" answers (components/market/w1/more.ts): the next cards and the cursor after them, or why not. */
export type W1More = { ok: true; items: MkCard[]; next: string | null } | { ok: false; error: string; detail: string };
