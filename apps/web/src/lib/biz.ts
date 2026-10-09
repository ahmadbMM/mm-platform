import { edgeStore, memo, resetMemo } from "./memo";
import type { SiteContent } from "./site";

// The business values admins change in the booking app's staff page without a deploy (Settings >
// Business and Settings > Pricing, 2026-10-09), read here from the same two public places the
// booking app's own rider pages read them (app.src.html _bizPubBoot / _bizApplyPub / _pricesApply):
//
//   site_content 'biz.public'  the settings a rider's page uses, mirrored there by staff_set_biz:
//                              the booking caps (which the database's _group_ride_cap reads too),
//                              the rating's "tell us why" line, the fallback fare, the cancel
//                              reasons, and the footer's address, hours and VAT number. It comes
//                              with the rest of the site's content (lib/site.ts loadSiteContent,
//                              which reads every key but journal.*), so it costs no read of its own.
//   ride_prices                the fares: price, the highest fare a type is quoted at (max_price)
//                              and the Petromin employees' fare (employee_price).
//
// Every value keeps the booking app's built-in constant as its default and passes the same range
// check (_bizN), so nothing on the site moves until an admin changes it, and a value out of range
// reads as the default, as it does in the app.

/** The booking app's built-in values (app.src.html), the defaults when nothing is set. */
export const BIZ_DEFAULTS = {
  groupRideMax: 2, // GROUP_RIDE_MAX: riders per account on a group ride (Petromin)
  eventSeatMax: 5, // EVENT_SEAT_MAX: seats per account on a ticketed event
  jccAccountCap: 3, // JCC_ACCOUNT_CAP: riders per account on a circuit evening
  rgLow: 8, // RG_LOW: a rating at or under this asks why
  defaultPrice: 57.5, // DEFAULT_PRICE: the fare of a bike type with none of its own
} as const;

export type BizPublic = {
  groupRideMax: number;
  eventSeatMax: number;
  jccAccountCap: number;
  rgLow: number;
  defaultPrice: number;
  /** Built-in cancel reasons staff switched off (their codes; never "other"). */
  cancelOff: string[];
  /** The admins' own cancel reasons, [code, words as typed]. */
  cancelCustom: [string, string][];
  /** The store address and opening hours as Settings has them, per language ({en, ar}); null when unset. */
  addr: Record<string, string> | null;
  hours: Record<string, string> | null;
  /** The VAT number (15 digits), or null when Settings has none. */
  vatNo: string | null;
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : d);
const words = (v: unknown): Record<string, string> | null => {
  if (!isObj(v)) return null;
  const out: Record<string, string> = {};
  for (const [k, s] of Object.entries(v)) if (/^[a-z]{2}$/.test(k) && typeof s === "string" && s.trim()) out[k] = s.trim().slice(0, 160);
  return Object.keys(out).length ? out : null;
};

/** The public business settings from the site's content (its 'biz.public' row), each checked as
 *  the booking app checks it, the built-in value where there is none or it is out of range. */
export function bizOf(content: SiteContent | null | undefined): BizPublic {
  const b = isObj(content?.["biz.public"]) ? (content["biz.public"] as Record<string, unknown>) : {};
  const off = Array.isArray(b.cancel_off) ? b.cancel_off.filter((x): x is string => typeof x === "string" && x !== "other").slice(0, 60) : [];
  const own = Array.isArray(b.cancel_custom) ? b.cancel_custom : [];
  const vat = String(b.vat_no ?? "").trim();
  return {
    groupRideMax: num(b.group_ride_max, BIZ_DEFAULTS.groupRideMax, 1, 20),
    eventSeatMax: num(b.event_seat_max, BIZ_DEFAULTS.eventSeatMax, 1, 50),
    jccAccountCap: num(b.jcc_account_cap, BIZ_DEFAULTS.jccAccountCap, 1, 50),
    rgLow: num(b.rg_low, BIZ_DEFAULTS.rgLow, 1, 9),
    defaultPrice: num(b.default_price, BIZ_DEFAULTS.defaultPrice, 1, 5000),
    cancelOff: off,
    cancelCustom: own
      .filter((x): x is { code: string; label: string } => isObj(x) && typeof x.code === "string" && /^c_[a-z0-9_]{1,40}$/.test(x.code) && typeof x.label === "string" && !!x.label.trim())
      .slice(0, 20)
      .map((x) => [x.code, x.label.trim().slice(0, 60)]),
    addr: words(b.addr),
    hours: words(b.hours),
    vatNo: /^\d{15}$/.test(vat) ? vat : null,
  };
}

/** A Settings text in this language as the booking app's footer picks it (_bizFoot): the
 *  language's own, else the English one (never for Arabic, which keeps its own words then). */
export function bizWords(w: Record<string, string> | null, locale: string): string | null {
  if (!w) return null;
  return w[locale] || (locale !== "ar" ? w.en : "") || null;
}

// ── Fares ──────────────────────────────────────────────────────────────────────────────────────

/** The booking app's built-in fares (RIDE_PRICES, RIDE_PRICES_MAX, EMPLOYEE_PRICES). */
export const APP_FARES = {
  price: { Road: 75, Mountain: 57.5, Hybrid: 57.5, Kids: 57.5, Any: 57.5, "Road Carbon": 250, Own: 0 } as Record<string, number>,
  max: { Road: 75, Mountain: 57.5, Hybrid: 57.5, Kids: 57.5, Any: 75, "Road Carbon": 250, Own: 0 } as Record<string, number>,
  employee: { Mountain: 50, Hybrid: 50, Kids: 50, Any: 50 } as Record<string, number>,
};

export type PriceRow = { type: string; price: number; max_price?: number | null; employee_price?: number | null };
export type Fares = { price: Record<string, number>; max: Record<string, number>; employee: Record<string, number> };

const fare = (v: unknown): v is number | string => v != null && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 5000;

/**
 * The fares as the booking app works them out (_pricesApply): ride_prices' rows over the built-in
 * lists. A type's highest fare is its max_price, else its own fare (Any: the dearest of the four
 * everyday types); a Petromin employee's fare is employee_price where a row has one, none where the
 * row says null. With no rows at all, the built-in lists as they are.
 */
export function faresOf(rows: readonly PriceRow[] | null | undefined): Fares {
  const f: Fares = { price: { ...APP_FARES.price }, max: { ...APP_FARES.max }, employee: { ...APP_FARES.employee } };
  if (!Array.isArray(rows) || !rows.length) return f;
  for (const r of rows) if (r && typeof r.type === "string" && r.type !== "Own" && fare(r.price)) f.price[r.type] = Number(r.price);
  const top = Math.max(...["Road", "Mountain", "Hybrid", "Kids"].map((t) => f.price[t]).filter((v) => v != null));
  for (const t of Object.keys(f.price)) if (t !== "Own") f.max[t] = t === "Any" && Number.isFinite(top) ? Math.max(top, f.price.Any || 0) : f.price[t];
  for (const r of rows) {
    if (!r || typeof r.type !== "string" || r.type === "Own") continue;
    if (fare(r.max_price)) f.max[r.type] = Math.max(Number(r.max_price), f.price[r.type] || 0);
    if ("employee_price" in r) {
      if (fare(r.employee_price)) f.employee[r.type] = Number(r.employee_price);
      else delete f.employee[r.type];
    }
  }
  return f;
}

/** ride_prices' rows as read, checked (a type, a price; the other two columns when the database
 *  has them). */
export function priceRows(v: unknown): PriceRow[] | null {
  if (!Array.isArray(v)) return null;
  return v
    .filter((x): x is Record<string, unknown> => isObj(x) && typeof x.type === "string" && fare(x.price))
    .map((x) => ({
      type: x.type as string,
      price: Number(x.price),
      ...("max_price" in x ? { max_price: fare(x.max_price) ? Number(x.max_price) : null } : {}),
      ...("employee_price" in x ? { employee_price: fare(x.employee_price) ? Number(x.employee_price) : null } : {}),
    }));
}

const TTL_MS = 60_000; // a fare an admin changes shows within a minute
const KEY = "fares";

/**
 * The fares, read once per Worker instance and kept for a minute like the site's content (lib/memo.ts:
 * shared reads, the stale copy served while it refreshes, the last good copy - this instance's, else
 * the edge's - for a failed read). The read asks for every column (`*`): ride_prices is a handful of
 * rows, and a database without max_price / employee_price yet still answers. With nothing ever
 * read, the booking app's built-in fares.
 */
export async function loadFares(fetchImpl: typeof fetch = fetch, now: number = Date.now()): Promise<Fares> {
  const rows = await memo<{ rows: PriceRow[] }>(KEY, {
    ttl: TTL_MS,
    now,
    keep: edgeStore("fares"),
    read: async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) return null;
      try {
        const res = await fetchImpl(`${url}/rest/v1/ride_prices?select=*`, {
          headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(2500),
        });
        const r = res.ok ? priceRows(await res.json()) : null;
        return r ? { rows: r } : null;
      } catch {
        return null;
      }
    },
  });
  return faresOf(rows?.rows);
}

/** For tests: forget the cached copy. */
export function resetFares(): void {
  resetMemo(KEY);
}
