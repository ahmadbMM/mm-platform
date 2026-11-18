import type { CartItem, CartLine } from "./cart";
import type { SiteContent } from "./site";
import type { Fulfil } from "./store-delivery";
import { digitsOnly, latinDigits, storePhone } from "./store-form";
import { handoverPickOf, type HandoverPick } from "./sx-b3-handover";

// The cart, checkout and the quote link (build of 2026-11-18, "do all": the research report "Store and Experiences
// mobile design", builder B3). Rules only; nothing here reads anything, so the browser's components use it too:
// - P10 / SM10-B: the cart and checkout keep their place before the browser's cart is read, from the height they had
//   when last drawn (a cookie), or from the number of lines (a cookie the cart writes) on a first visit;
// - N23: a quote staff built (store_quote_get) opened at /store/q/<token>;
// - N34: buying for a company (a standard tax invoice with the buyer's VAT number, name and address);
// - N07: a map pin for a Jeddah delivery; N15: handed over at one of the rider's own booked sessions; N17: "I'm still
//   learning" with a bike; N13: the handover slot (lib/sx-b3-handover.ts);
// - the switches staff keep in Payments > Settings (absent = off: the database work arrives after the website).

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// ── The switches ────────────────────────────────────────────────────────────────────────────────────

export type SxSettings = {
  /** N34 store.company.on */ company: boolean;
  /** N07 store.pin.on */ pin: boolean;
  /** N17 store.learning.on (and learn-to-ride taking sign-ups, checked by the page) */ learning: boolean;
  /** N15 store.sessionHandover {on, days}: how many days ahead a booked session may be */ session: { on: boolean; days: number };
  /** N13 store.handover.on: the page then asks the database which slots are free */ handover: boolean;
  /** N20 store.giftCardWallet.on: a store gift card's balance moved into the account's wallet */ giftWallet: boolean;
};

export function sxSettings(c: SiteContent | null | undefined): SxSettings {
  const on = (k: string) => obj(c?.[k]).on === true || c?.[k] === true;
  const sh = obj(c?.["store.sessionHandover"]);
  const days = typeof sh.days === "number" && Number.isInteger(sh.days) && sh.days >= 1 && sh.days <= 60 ? sh.days : 21;
  return {
    company: on("store.company.on"), pin: on("store.pin.on"), learning: on("store.learning.on"),
    session: { on: sh.on === true, days }, handover: on("store.handover"), giftWallet: on("store.giftCardWallet.on"),
  };
}

// ── P10 / SM10-B: the cart's height kept before it is read ─────────────────────────────────────────

/** The cookies: how many lines the cart has (written with the cart), and the cart's and checkout's box heights when last
 *  drawn: "<lines>.<narrow>.<wide>" (narrow: under 900 px, the lines over the summary; wide: side by side; 0 = not seen).
 *  A height drawn for another number of lines is not this cart's: the count's estimate stands in for it then. */
export const CART_N_COOKIE = "mm-cart-n";
export const boxCookie = (k: "cart" | "co") => `mm-h-${k}`;
export const WIDE = 900;
export type Reserve = { n: number; narrow: number; wide: number };

const px = (v: string | undefined) => { const n = Number(v); return v !== undefined && v !== "" && Number.isInteger(n) && n >= 0 && n <= 20000 ? n : 0; };

/** What the server reads to keep the box's place: the line count and the heights last drawn for it. */
export function reserveOf(nCookie: string | undefined, hCookie: string | undefined): Reserve {
  const n = Math.min(20, px(nCookie));
  const [hn, a, b] = (hCookie ?? "").split(".");
  const same = !!hCookie && px(hn) === n;
  return { n, narrow: same ? px(a) : 0, wide: same ? px(b) : 0 };
}

/** A box height kept again for `n` lines: the one for this width replaced, the other kept while the count is the same. */
export function boxValue(prev: string | undefined, n: number, wide: boolean, h: number): string {
  const [pn, a, b] = (prev ?? "").split(".");
  const keep = !!prev && px(pn) === n, v = Math.max(0, Math.min(20000, Math.round(h)));
  return wide ? `${n}.${keep ? px(a) : 0}.${v}` : `${n}.${v}.${keep ? px(b) : 0}`;
}

/** One cart line in the one template (SM10-B): 72 px photo row and the 44 px row of controls, with its padding. */
export const LINE_PX = 155;
/** The cart's height drawn from its lines when it was never measured: the lines (and the total row on a phone, SM10-C)
 *  over the summary, or beside it; the empty cart's message box otherwise. */
export function cartEstimate(n: number, wide: boolean): number {
  if (n <= 0) return 140;
  const lines = n * LINE_PX + 2;
  return wide ? Math.max(lines, 560) : 84 + lines + 20 + 560;
}
/** Checkout's height from its lines: the open first step (about 470 px) and the closed ones, then the summary with each
 *  line's 72 px row (beside on a wide screen). */
export function checkoutEstimate(n: number, wide: boolean): number {
  if (n <= 0) return 140;
  const steps = 470 + 3 * 80, sum = 560 + n * 72;
  return wide ? Math.max(steps, sum) : steps + 20 + sum;
}

/** The two heights to keep, from what was measured or else from the line count. */
export function reserveHeights(r: Reserve, kind: "cart" | "co"): { narrow: number; wide: number } {
  const est = kind === "cart" ? cartEstimate : checkoutEstimate;
  return { narrow: r.narrow || est(r.n, false), wide: r.wide || est(r.n, true) };
}

// ── N23: a quote ────────────────────────────────────────────────────────────────────────────────────

export const quoteTokenOk = (t: string) => /^[a-z0-9]{24,40}$/.test(t);
export type QuoteState = "open" | "used" | "expired" | "void";
export type Quote = {
  state: QuoteState; no: number; items: CartItem[]; fulfil: Fulfil | null;
  slot: { day: string; time: string } | null; handover: HandoverPick | null;
  name: string; phone: string; expires: string; orderNo: number | null;
};

/** store_quote_get's answer, or null (not found, malformed). */
export function quoteOf(raw: unknown): Quote | null {
  const o = obj(raw);
  const state = o.state === "open" || o.state === "used" || o.state === "expired" || o.state === "void" ? o.state : null;
  const no = typeof o.no === "number" && Number.isInteger(o.no) && o.no > 0 ? o.no : null;
  if (!state || !no) return null;
  const items = (Array.isArray(o.items) ? o.items : []).slice(0, 20).map(obj)
    .map((x) => ({ variant: str(x.variant, 36).toLowerCase(), qty: Number(x.qty) }))
    .filter((x) => /^[0-9a-f-]{36}$/.test(x.variant) && Number.isInteger(x.qty) && x.qty >= 1 && x.qty <= 10);
  const f = o.fulfil === "pickup" || o.fulfil === "jeddah" || o.fulfil === "ksa" ? o.fulfil : null;
  const sl = obj(o.slot);
  const slot = typeof sl.day === "string" && DAY.test(sl.day) && typeof sl.time === "string" && /^[a-z0-9]{1,12}$/.test(sl.time) ? { day: sl.day, time: sl.time } : null;
  return {
    state, no, items: state === "open" ? items : [], fulfil: f, slot, handover: handoverPickOf(o.handover),
    // the mobile as a customer writes it (05X XXX XXXX), from the database's 9665XXXXXXXX
    name: str(o.name, 60), phone: ((p) => (p ? `0${p.slice(3)}` : ""))(storePhone(str(o.phone, 20))),
    expires: typeof o.expires_at === "string" ? o.expires_at : "", orderNo: typeof o.order_no === "number" ? o.order_no : null,
  };
}

/** The quote's number as staff say it ("Q-12"). */
export const quoteNo = (n: number) => `Q-${n}`;

// ── N34: buying for a company ───────────────────────────────────────────────────────────────────────

export type Company = { name: string; vat: string; cr: string; building: string; street: string; district: string; city: string; postal: string };
export const EMPTY_COMPANY: Company = { name: "", vat: "", cr: "", building: "", street: "", district: "", city: "", postal: "" };
/** The fields' ids on the page and the problems' names: co + the field. */
export const COMPANY_FIELDS = ["coName", "coVat", "coCr", "coBuilding", "coStreet", "coDistrict", "coCity", "coPostal"] as const;
const KEY: Record<(typeof COMPANY_FIELDS)[number], keyof Company> = {
  coName: "name", coVat: "vat", coCr: "cr", coBuilding: "building", coStreet: "street", coDistrict: "district", coCity: "city", coPostal: "postal",
};
export const companyKey = (f: string): keyof Company | null => KEY[f as keyof typeof KEY] ?? null;

/** A Saudi VAT registration number: 15 digits, the first and the last 3. */
export const vatOk = (v: string) => /^3\d{13}3$/.test(v);
/** What a number field keeps as it is typed: Latin digits only, so many at most. */
export const companyDigits = (k: keyof Company, raw: string) =>
  k === "vat" ? digitsOnly(raw, 15) : k === "cr" ? digitsOnly(raw, 10) : k === "building" ? digitsOnly(raw, 4) : k === "postal" ? digitsOnly(raw, 5) : raw;

/** The company's fields to fix (the database's rules, store_checkout_plus): its name, a valid VAT number, a CR number
 *  only when given, and the national address a standard tax invoice carries (building number, street, district, city,
 *  postal code). */
export function companyProblems(c: Company): string[] {
  const out: string[] = [];
  const n = c.name.trim().replace(/\s+/g, " ");
  if (n.length < 2 || n.length > 100) out.push("coName");
  if (!vatOk(c.vat)) out.push("coVat");
  if (c.cr && !/^\d{10}$/.test(c.cr)) out.push("coCr");
  if (!/^\d{4}$/.test(c.building)) out.push("coBuilding");
  if (!c.street.trim()) out.push("coStreet");
  if (!c.district.trim()) out.push("coDistrict");
  if (!c.city.trim()) out.push("coCity");
  if (!/^\d{5}$/.test(c.postal)) out.push("coPostal");
  return out;
}

export type CompanyBody = { name: string; vat: string; cr?: string; address: { building: string; street: string; district: string; city: string; postal: string } };
export function companyBody(c: Company): CompanyBody {
  return {
    name: c.name.trim().replace(/\s+/g, " "), vat: c.vat, cr: c.cr || undefined,
    address: { building: c.building, street: c.street.trim(), district: c.district.trim(), city: c.city.trim(), postal: c.postal },
  };
}

/** The buyer a standard tax invoice names (the order's `company`), or null for a simplified invoice. */
export type Buyer = { name: string; vat: string; cr: string; address: string };
export function buyerOf(raw: unknown): Buyer | null {
  const c = obj(obj(raw).company);
  const name = str(c.name, 100), vat = str(c.vat, 15);
  if (!name || !vatOk(vat)) return null;
  const a = obj(c.address);
  const address = [str(a.building, 4) && str(a.street, 80) ? `${str(a.building, 4)} ${str(a.street, 80)}` : str(a.street, 80), str(a.district, 60), str(a.city, 40), str(a.postal, 5)]
    .filter(Boolean).join(", ");
  return { name, vat, cr: /^\d{10}$/.test(str(c.cr, 10)) ? str(c.cr, 10) : "", address };
}

// ── N07: the map pin of a Jeddah delivery ───────────────────────────────────────────────────────────

export type Pin = { lat: number; lng: number };
/** Where the map opens: central Jeddah. */
export const JEDDAH: Pin = { lat: 21.5433, lng: 39.1728 };
/** Jeddah and its edges, as the database takes a pin (store_checkout_plus, STORE_PIN). */
export const pinOk = (p: Pin | null | undefined): p is Pin =>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= 21 && p.lat <= 22.4 && p.lng >= 38.8 && p.lng <= 39.8;
/** Five decimals: about a metre, all a driver needs. */
export const roundPin = (p: Pin): Pin => ({ lat: Math.round(p.lat * 1e5) / 1e5, lng: Math.round(p.lng * 1e5) / 1e5 });
export function pinOf(raw: unknown): Pin | null {
  const o = obj(raw), p = { lat: Number(o.lat), lng: Number(o.lng) };
  return pinOk(p) ? roundPin(p) : null;
}
/** The staff sheet's "Open in Maps" (Google Maps' universal link opens the app on a phone). */
export const mapsHref = (p: Pin) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;

// ── N15: handed over at a booked session ────────────────────────────────────────────────────────────

/** Small things only: every line one a courier may carry (store_products.ship_ksa), never a bike or a gift card. */
export function smallOnly(lines: readonly CartLine[]): boolean {
  return lines.length > 0 && lines.every((l) => !!l.product && l.product.ship_ksa && l.product.category !== "bikes" && l.product.kind !== "gift_card");
}

export type SessionChoice = { entry: string; session: string; date: string };
/** The rider's own seated bookings (my_bookings rows: status active, never a waitlist place) whose day is from `from`
 *  (the day an order is ready) to `to`, soonest first, one per session. */
export function sessionChoices(rows: readonly Record<string, unknown>[], from: string, to: string): SessionChoice[] {
  const seen = new Set<string>(), out: SessionChoice[] = [];
  const list = rows
    .map((r) => ({ entry: str(r.id, 80), session: str(r.session_id, 80), date: str(r.session_date, 10), status: r.status }))
    .filter((r) => r.entry && r.session && DAY.test(r.date) && r.status === "active" && r.date >= from && r.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.session.localeCompare(b.session));
  for (const r of list) {
    if (seen.has(r.session)) continue;
    seen.add(r.session);
    out.push({ entry: r.entry, session: r.session, date: r.date });
  }
  return out.slice(0, 6);
}

/** A day `n` days after `day` (YYYY-MM-DD). */
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// ── What checkout sends beyond the store build's body ───────────────────────────────────────────────

export type Extras = {
  quote?: string; company?: CompanyBody; pin?: Pin; handover?: HandoverPick; session?: string; learning?: true;
  /** a Jeddah slot on a Ramadan day or one of its windows (N36): only store_checkout_plus checks the season */
  season?: true;
};
export const hasExtras = (x: Extras) => Object.values(x).some((v) => v !== undefined);

/** The extras of POST /api/store/checkout's body, as the route passes them on (store_checkout_plus checks each again). */
export function extrasOf(b: Record<string, unknown>): Extras {
  const out: Extras = {};
  if (typeof b.quote === "string" && quoteTokenOk(b.quote)) out.quote = b.quote;
  const c = obj(b.company), a = obj(c.address);
  if (typeof c.name === "string") {
    out.company = {
      name: str(c.name, 100), vat: digitsOnly(str(c.vat, 30), 15), cr: str(c.cr, 10) ? digitsOnly(str(c.cr, 20), 10) : undefined,
      address: { building: digitsOnly(str(a.building, 10), 4), street: str(a.street, 80), district: str(a.district, 60), city: str(a.city, 40), postal: digitsOnly(str(a.postal, 10), 5) },
    };
  }
  const pin = pinOf(b.pin);
  if (pin) out.pin = pin;
  const h = handoverPickOf(b.handover);
  if (h) out.handover = h;
  if (typeof b.session === "string" && /^[A-Za-z0-9_.:-]{1,80}$/.test(b.session)) out.session = b.session;
  if (b.learning === true) out.learning = true;
  if (b.season === true) out.season = true;
  return out;
}

/** The order's extras as the order page shows them (the order's JSON; absent on a database without them). */
export type OrderExtras = {
  buyer: Buyer | null; pinned: boolean; handover: { day: string; at: string; to: string } | null;
  session: { date: string } | null; learning: boolean; quoteNo: number | null;
};
export function orderExtrasOf(raw: unknown): OrderExtras {
  const o = obj(raw), h = obj(o.handover), s = obj(o.session);
  const hm = (v: unknown) => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  return {
    buyer: buyerOf(o),
    pinned: o.pinned === true || !!pinOf(o.pin),
    handover: typeof h.day === "string" && DAY.test(h.day) && hm(h.at) && hm(h.to) ? { day: h.day, at: h.at as string, to: h.to as string } : null,
    session: typeof s.date === "string" && DAY.test(s.date) ? { date: s.date } : null,
    learning: o.learning === true,
    quoteNo: typeof o.quote_no === "number" && Number.isInteger(o.quote_no) ? o.quote_no : null,
  };
}

// ── Refusals ────────────────────────────────────────────────────────────────────────────────────────

/** store_checkout_plus's own refusals (rentals, SX/sql/B3.sql) as the page's codes; the rest are payError's. */
export const SX_CODES: Record<string, string> = {
  STORE_QUOTE: "quote", STORE_QUOTE_USED: "quote_used", STORE_QUOTE_EXPIRED: "quote_expired", STORE_QUOTE_CHANGED: "quote_changed",
  STORE_COMPANY: "company", STORE_PIN: "pin", STORE_HANDOVER: "handover", STORE_SESSION: "session", STORE_LEARNING: "invalid",
  STORE_GIFT_WALLET: "gift_wallet",
};
/** The code a refusal's message names ("STORE_HANDOVER: full" -> "handover"), or null when it is not one of these. */
export function sxRefusal(message: string | null | undefined): string | null {
  const head = latinDigits(String(message ?? "")).split(":")[0].trim();
  return SX_CODES[head] ?? null;
}
/** Where one of those belongs on the page: a step's field, or the form as a whole. */
export function sxPlace(code: string): string | null {
  return code === "company" ? "coVat" : code === "pin" ? "pin" : code === "handover" ? "handover" : code === "session" ? "session" : null;
}

// ── Checkout's draft and body ───────────────────────────────────────────────────────────────────────

/** What checkout keeps for these features while it is typed (inside its sessionStorage draft). */
export type SxDraft = { buying: boolean; company: Company; pin: Pin | null; handover: HandoverPick | null; session: string | null; learning: boolean };
export const EMPTY_SX: SxDraft = { buying: false, company: EMPTY_COMPANY, pin: null, handover: null, session: null, learning: false };

/** The draft as it was kept (anything malformed left out), with a slot a quote or the buy box picked when none was. */
export function sxDraftOf(raw: unknown, preset?: HandoverPick | null): SxDraft {
  const o = obj(raw), c = obj(o.company);
  const company = Object.fromEntries((Object.keys(EMPTY_COMPANY) as (keyof Company)[]).map((k) => [k, str(c[k], 100)])) as Company;
  return {
    buying: o.buying === true, company, pin: pinOf(o.pin), handover: handoverPickOf(o.handover) ?? preset ?? null,
    session: typeof o.session === "string" && o.session ? o.session.slice(0, 80) : null, learning: o.learning === true,
  };
}

/** The fields to fix these features add (only a company's: the pin, the slot and the session are picked, never typed). */
export const sxProblems = (d: SxDraft, companyOn: boolean): string[] => (companyOn && d.buying ? companyProblems(d.company) : []);

/** What the order sends of these features, only where they apply: the quote; the company while buying for one; the
 *  pin on a Jeddah delivery; on pickup either the session (small things) or, with a bike, the handover slot; "still
 *  learning" with a bike; the season mark on a Jeddah slot during Ramadan. */
export function sxExtras(a: {
  d: SxDraft; way: Fulfil | "digital"; bike: boolean; small: boolean; quote: string | null; on: SxSettings; learnOpen: boolean;
  sessions: readonly { entry: string }[]; handoverOpen: boolean; seasonSlot: boolean;
}): Extras {
  const out: Extras = {};
  if (a.quote) out.quote = a.quote;
  if (a.on.company && a.d.buying) out.company = companyBody(a.d.company);
  if (a.on.pin && a.way === "jeddah" && a.d.pin) out.pin = a.d.pin;
  const session = a.way === "pickup" && a.on.session.on && a.small && a.d.session && a.sessions.some((s) => s.entry === a.d.session) ? a.d.session : null;
  if (session) out.session = session;
  else if (a.way === "pickup" && a.bike && a.on.handover && a.handoverOpen && a.d.handover) out.handover = a.d.handover;
  if (a.on.learning && a.learnOpen && a.bike && a.d.learning) out.learning = true;
  if (a.way === "jeddah" && a.seasonSlot) out.season = true;
  return out;
}
