// Booking a ride on the website, as the booking app books one (app.src.html renderRegister /
// submitReg): the same steps, the same caps, the same bike types and prices, the same checks. The
// plain logic lives here so the browser's wizard (components/experiences/BookingFlow.tsx) and the
// server's booking route (app/api/booking) answer every question the same way, and so it can be
// tested. The database stays the authority: customer_create_booking and its triggers price every
// row (_enforce_booking_price, _fare_now), gate the members' rides, cap the parties and the solo
// rides and coerce a booking past capacity onto the waitlist; nothing here can make a booking
// cheaper or let one through that the database would refuse.
import type { RideKind } from "./rides";

/** A session as the wizard reads it: what lib/rides.ts reads for the cards, and the rest of the
 *  row the booking needs. Display strings (the day, the clock) are made on the server, so the
 *  browser draws exactly what the server did. */
export type BookSession = {
  id: string;
  date: string;
  kind: RideKind;
  /** The ride's name as the page says it (sessionName), "" for a circuit night. */
  name: string;
  full: boolean;
  /** A community ride: one seat per member, never priced per type unless a paid ride. */
  community: boolean;
  /** Booked only by community members (the Saturday tag): community and not open_to_all. */
  members: boolean;
  /** Nothing to pay (_isFreeRide): a community ride that is not a paid ride. */
  free: boolean;
  /** Staff approve each rider (_isApprovalRide): community and needs_approval not false. */
  approval: boolean;
  /** An event's price per seat in SAR (0 on a free event); null on a bike ride. */
  seat: number | null;
  /** Capacity as the app counts places (spots on an approval ride, else capacity; 12 unset). */
  capacity: number;
  /** Places left when counted, else null (an approval ride never shows it). */
  left: number | null;
  /** The waitlist's cap in riders (waitlistCap), null for none. */
  wlCap: number | null;
  /** The Saturday ride's two distances (_rgKm), km. */
  km: { beg: number; int: number };
  /** Add-on items this session sells (inventory ids, sessions.addons). */
  addons: string[];
  meetUrl: string | null;
  location: string | null;
  routeSlug: string | null;
  /** "Sunday · 4 Oct 2026" and "Today"/"Tomorrow" (null), as the server wrote them. */
  day: string;
  near: string | null;
  /** The card's time line ("Gathering 6:30 AM · Start 7 AM" / "9 PM – 11 PM"). */
  time: string;
  /** "Collect bikes from 8:15 PM", or null. */
  collect: string | null;
  /** Not open to book yet: the words for when it opens; null when it may be booked. */
  opens: string | null;
  description: string | null;
};

/** The signed-in account, as the wizard needs it (lib/booking-server.ts bookingAccount). */
export type BookAccount = {
  name: string;
  height: number | null;
  /** Bike types staff hid from this account's picker (customers.hidden_types; a VIP's Road Carbon). */
  hidden: string[];
  /** The account's own default payment: 'all', the types on the house, or null. */
  house: "all" | string[] | null;
  /** Holds the community tag (community_member). */
  member: boolean;
  /** Sessions staff turned this account down for (a booking with approval 'rejected'). */
  rejected: string[];
  /** Live rows (waiting, on the bike, waitlisted) this account holds, per session. */
  live: Record<string, number>;
  /** Account fields the server holds the booking for (customer_fix_fields: FIX_FIRST). */
  asks: string[];
  /** The profile page before a booking (_profileGate): eight bookings and no birth date or
   *  nationality on file; or a community member's two asks (customer_fix_save takes them). */
  profileGate: "none" | "profile" | "community";
  birth: string;
  nationality: string;
};

// ── What a session involves (KIND_TRAITS) ────────────────────────────────────────────────────
const NO_BIKE: RideKind[] = ["swim", "workshop", "event"];
export const needsBike = (s: Pick<BookSession, "kind">) => !NO_BIKE.includes(s.kind);
/** Which waiver a kind is agreed under (_waiverKind): the ride's where there is a bike, the swim's
 *  for the swim, the activity waiver for everything else (workshop, event, any other kind). */
export type WaiverKind = "bike" | "swim" | "activity";
const BIKE_WAIVER: RideKind[] = ["jcc", "saturday", "petromin", "snd96"];
export const waiverKind = (s: Pick<BookSession, "kind">): WaiverKind => (BIKE_WAIVER.includes(s.kind) ? "bike" : s.kind === "swim" ? "swim" : "activity");
/** Every booking needs an agreed waiver (owner, 2026-10-03: "you can't book anything without
 *  agreeing"; the database refuses one without: WAIVER_REQUIRED). */
export const needsWaiver = (s: Pick<BookSession, "kind">) => Boolean(waiverKind(s));
/** The wizard's path (_regSteps): the riders step only where there is a bike, then the waiver
 *  (every booking), then the review. */
export type Step = 1 | 2 | 2.5 | 3;
export function regSteps(s: Pick<BookSession, "kind">): Step[] {
  const st: Step[] = [1];
  if (needsBike(s)) st.push(2);
  if (needsWaiver(s)) st.push(2.5);
  st.push(3);
  return st;
}
export const nextStep = (s: Pick<BookSession, "kind">, cur: Step): Step => {
  const st = regSteps(s), i = st.indexOf(cur);
  return i >= 0 && i < st.length - 1 ? st[i + 1] : 3;
};
export const prevStep = (s: Pick<BookSession, "kind">, cur: Step): Step => {
  const st = regSteps(s), i = st.indexOf(cur);
  return i > 0 ? st[i - 1] : 1;
};
/** A ride that gathers then sets off (the Saturday and National Day rides). */
export const gathers = (s: Pick<BookSession, "kind">) => s.kind === "saturday" || s.kind === "snd96";
/** "I have my own bike" is offered on every community ride and the National Day ride (_ownOffered). */
export const ownOffered = (s: Pick<BookSession, "community" | "kind">) => s.community || s.kind === "snd96";
/** No Road Carbon on a community ride but Petromin (_noCarbon). */
export const noCarbon = (s: Pick<BookSession, "community" | "kind">) => s.community && s.kind !== "petromin";
/** The Saturday ride's two groups (RIDE_GROUPS). */
export const hasRideGroups = (s: Pick<BookSession, "kind">) => s.kind === "saturday";
export type RideGroup = "beg" | "int";
export const RIDE_GROUPS: RideGroup[] = ["beg", "int"];
export const rgOk = (g: unknown): g is RideGroup => g === "beg" || g === "int";

/** One account books at most three riders on a circuit night (JCC_ACCOUNT_CAP), drawn from the
 *  rows it already holds there; one on a community ride. */
export const JCC_ACCOUNT_CAP = 3;
export function maxRiders(s: Pick<BookSession, "community" | "kind">, booked: number): number {
  if (s.community) return 1; // the Petromin ride (two) is booked through its own form, never here
  return Math.max(1, JCC_ACCOUNT_CAP - booked);
}

// ── Bike types and prices ────────────────────────────────────────────────────────────────────
/** The types a rider picks from, in the booking app's order (CUST_TYPES without Any: "No
 *  preference" is staff's to give since 2026-10-02, and Gravel is not a rental type). */
export const RIDER_TYPES = ["Road", "Hybrid", "Mountain", "Kids", "Road Carbon", "Own"] as const;
export type BikeType = (typeof RIDER_TYPES)[number];
export const isRiderType = (v: unknown): v is BikeType => typeof v === "string" && (RIDER_TYPES as readonly string[]).includes(v);

/** The picker's types for this session and account (bikeTypeOpts, less what staff hid). */
export function typeOptions(s: Pick<BookSession, "community" | "kind">, hidden: string[] = []): BikeType[] {
  const all = RIDER_TYPES.filter((t) => (t !== "Own" || ownOffered(s)) && (t !== "Road Carbon" || !noCarbon(s)));
  const shown = all.filter((t) => !hidden.includes(t));
  return shown.length ? shown : all;
}

/** The booking app's own figures (RIDE_PRICES), used only where the database's ride_prices has
 *  no row: the database charges ride_prices, so the page shows ride_prices. */
export const APP_PRICES: Record<string, number> = { Road: 75, Hybrid: 57.5, Mountain: 57.5, Kids: 57.5, Any: 57.5, "Road Carbon": 250, Own: 0 };
export type Prices = Record<string, number>;
/** ride_prices as a map, with the app's figures where a row is missing. */
export function priceMap(rows: { type: string; price: number }[]): Prices {
  const m: Prices = { ...APP_PRICES };
  for (const r of rows) if (r.type !== "Own" && Number.isFinite(r.price) && r.price >= 0) m[r.type] = r.price;
  m.Own = 0; // _fare_now has no fare for a rider's own bike: it costs nothing
  return m;
}
/** What one rider's bike costs: the type's price (_booking_fare), or an event's seat. */
export const priceFor = (prices: Prices, type: string) => prices[type] ?? prices.Any ?? APP_PRICES.Any;
/** A type not chosen yet reads as Any: from the Any price to the dearest standard bike. */
export function unpickedRange(prices: Prices): [number, number] {
  const lo = priceFor(prices, "Any");
  const hi = Math.max(lo, ...["Road", "Hybrid", "Mountain"].map((t) => priceFor(prices, t)));
  return [lo, hi];
}

/** What a ride costs before anything is picked (_sessFromPrice): Free, a seat, or the cheapest
 *  bike it offers. "" for a day with nothing to rent (the pool, the workshop). */
export function fromPrice(s: Pick<BookSession, "free" | "seat" | "kind" | "community">, prices: Prices): { kind: "free" } | { kind: "from"; n: number } | { kind: "seat"; n: number } | null {
  if (s.free) return { kind: "free" };
  if (s.seat != null) return s.seat ? { kind: "seat", n: s.seat } : { kind: "free" };
  if (!needsBike(s)) return null;
  const ps = RIDER_TYPES.filter((t) => t !== "Own" && (t !== "Road Carbon" || !noCarbon(s))).map((t) => priceFor(prices, t));
  return ps.length ? { kind: "from", n: Math.min(...ps) } : null;
}

/** Whether the account's own default payment puts this type on the house (_houseCovers). */
export const houseCovers = (house: BookAccount["house"], type: string) => !!house && (house === "all" || house.includes(type));
/** The house perk lands only on rider 1, and only while rider 1 is the account holder (an empty
 *  name means the holder): _regHouseSelf. */
export const houseSelf = (acctName: string, rider0Name: string | undefined) => {
  const nm = (rider0Name ?? "").trim();
  return !nm || nm.toLowerCase() === acctName.trim().toLowerCase();
};

export type Rider = { name: string; height: string; type: BikeType | "" };
export type Promo = { code: string; kind: "flat" | "pct" | string; value: number; appliesTo: string | null };

/** One rider's price on the review: free, on the house, an amount, or a range (no type yet). */
export type PriceLine = { kind: "free" } | { kind: "house" } | { kind: "sar"; n: number } | { kind: "range"; lo: number; hi: number };
/** Each rider's line price, as the review lists them. */
export function riderPrices(s: Pick<BookSession, "free" | "seat">, riders: Rider[], prices: Prices, acct: Pick<BookAccount, "name" | "house"> | null): PriceLine[] {
  return riders.map((r, i): PriceLine => {
    if (s.free || r.type === "Own") return { kind: "free" as const };
    const hf = i === 0 && !!acct && houseSelf(acct.name, r.name) && houseCovers(acct.house, r.type || "Any");
    if (hf) return { kind: "house" as const };
    if (s.seat != null) return { kind: "sar" as const, n: s.seat };
    if (!r.type) { const [lo, hi] = unpickedRange(prices); return { kind: "range" as const, lo, hi }; }
    return { kind: "sar" as const, n: priceFor(prices, r.type) };
  });
}

/** The rental's total as a range (a type not picked yet counts as Any). */
export function rentalTotal(s: Pick<BookSession, "free" | "seat">, riders: Rider[], prices: Prices, acct: Pick<BookAccount, "name" | "house"> | null): [number, number] {
  let lo = 0, hi = 0;
  for (const p of riderPrices(s, riders, prices, acct)) {
    if (p.kind === "sar") { lo += p.n; hi += p.n; } else if (p.kind === "range") { lo += p.lo; hi += p.hi; }
  }
  return [round2(lo), round2(hi)];
}
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** What a code takes off the rental (_promoDiscount, _regPromoDisc): a type-restricted code
 *  discounts each matching bike; any other code the whole rental. A first rider on the house
 *  pays nothing, so their bike earns no discount. */
export function promoDiscount(p: Promo | null, s: Pick<BookSession, "free" | "seat">, riders: Rider[], prices: Prices, acct: Pick<BookAccount, "name" | "house"> | null): number {
  if (!p || s.free) return 0;
  const lines = riderPrices(s, riders, prices, acct);
  const base = lines.reduce((sum, l, i) => sum + (l.kind === "sar" ? l.n : l.kind === "range" ? priceFor(prices, riders[i].type || "Any") : 0), 0);
  if (p.appliesTo) {
    let d = 0;
    lines.forEach((l, i) => {
      if (riders[i].type !== p.appliesTo || l.kind !== "sar") return;
      d += p.kind === "flat" ? Math.min(Number(p.value), l.n) : l.n * (Number(p.value) / 100);
    });
    return Math.min(base, Math.max(0, round2(d)));
  }
  const d = p.kind === "flat" ? Number(p.value) : base * (Number(p.value) / 100);
  return Math.min(base, Math.max(0, round2(d)));
}

/** Which riders carry the code into the booking (_applyPromoToEntries): only the ones it
 *  discounts - the database counts a use per row that carries it. */
export function promoRows(p: Pick<Promo, "appliesTo"> | null, s: Pick<BookSession, "free">, riders: Pick<Rider, "type" | "name">[], acct: Pick<BookAccount, "name" | "house"> | null): boolean[] {
  return riders.map((r, i) => {
    if (!p || s.free || r.type === "Own" || !r.type) return false;
    if (i === 0 && acct && houseSelf(acct.name, r.name) && houseCovers(acct.house, r.type)) return false;
    return !p.appliesTo || p.appliesTo === r.type;
  });
}

// ── Add-ons ──────────────────────────────────────────────────────────────────────────────────
export type AddonItem = { id: string; name: string; brand: string; photo: string; price: number; qty: number; category: string; nutrition: boolean };
export type AddonPick = { id: string; qty: number };
/** How many of one item a booking may take (_setRegAddonQty): its stock, 10 when sold out
 *  (a backorder), never past 20 (the server's cap). */
export const addonCap = (it: Pick<AddonItem, "qty"> | undefined) => Math.min(20, it ? (it.qty > 0 ? it.qty : 10) : 0);
export function addonsCost(picks: AddonPick[], items: AddonItem[]): number {
  return round2(picks.reduce((sum, a) => sum + (items.find((x) => x.id === a.id)?.price ?? 0) * a.qty, 0));
}
const SUPP = ["ProteinSnacks", "ElectrolyteSachets", "EnergyGels"];
const DRINK = /drink|beverage|water|juice|soda|cola|tea|coffee|مشروب|عصير|ماء/i;
/** Equipment first, then Supplements, then Beverages (_aCatRank). */
export function addonCatRank(cat: string, items: AddonItem[]): number {
  if (DRINK.test(cat)) return 2;
  if (SUPP.includes(cat) || /^Protein[A-Z]/.test(cat) || (cat !== "Helmet" && items.some((i) => i.category === cat && i.nutrition))) return 1;
  return 0;
}
/** The add-ons a session sells, in stock first (sessionAddonItems); none on a free ride. */
export function sessionAddons(s: Pick<BookSession, "free" | "addons">, items: AddonItem[]): AddonItem[] {
  if (s.free) return [];
  return s.addons.map((id) => items.find((x) => x.id === id)).filter((x): x is AddonItem => !!x)
    .sort((a, b) => (a.qty > 0 ? 0 : 1) - (b.qty > 0 ? 0 : 1));
}

// ── Validation ───────────────────────────────────────────────────────────────────────────────
/** The frame size that suits a rider (the owner's chart, bikeFit): 144 cm and under is a Kids
 *  bike (no frame size kept), else Road's or Hybrid's chart. */
const ROAD: [number, string][] = [[159, "XS"], [172, "S"], [179, "M"], [189, "L"], [Infinity, "XL"]];
const HYBRID: [number, string][] = [[159, "XS"], [170, "S"], [185, "M"], [Infinity, "L"]];
export function heightToSize(h: number, type: string): string {
  if (!(h > 0) || h <= 144) return "";
  const chart = type === "Hybrid" || type === "Mountain" ? HYBRID : ROAD;
  return (chart.find(([max]) => h <= max) as [number, string])[1];
}
export const heightOk = (v: string | number) => { const h = typeof v === "number" ? v : parseInt(String(v), 10); return Number.isInteger(h) && h >= 100 && h <= 250; };

export type RiderError = { i: number; field: "height" | "type" | "name" } | { i: -1; field: "group" };
/** The riders step's checks, in the app's order (validateRegInputs): the group, each height,
 *  then each type and (in a party) each name. Null when all is well. */
export function validateRiders(s: Pick<BookSession, "kind" | "community">, riders: Rider[], group: RideGroup | null, acctName: string): RiderError | null {
  if (!needsBike(s)) return null;
  if (hasRideGroups(s) && !rgOk(group)) return { i: -1, field: "group" };
  for (let i = 0; i < riders.length; i++) if (!heightOk(riders[i].height)) return { i, field: "height" };
  for (let i = 0; i < riders.length; i++) {
    if (!riders[i].type) return { i, field: "type" };
    if (riders.length > 1 && !(riders[i].name.trim() || (i === 0 ? acctName : "")).trim()) return { i, field: "name" };
  }
  return null;
}

// ── The profile page (_profileGate) ──
/** A birth date the booking app takes (_dobErr): a real day, at least five and at most a hundred years ago. */
export function birthOk(v: string, today: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return false;
  const [ty, tm, td] = today.split("-").map(Number);
  const age = ty - +m[1] - (tm < +m[2] || (tm === +m[2] && td < +m[3]) ? 1 : 0);
  return age >= 5 && age <= 100;
}


// ── The answer the booking route gives ───────────────────────────────────────────────────────
/** Every refusal the wizard words (the app's _bookRefused and its own checks). */
export const REFUSALS = ["signin", "closed", "members", "rejected", "already", "one_per_session", "group_cap", "cap", "fix_first", "pick_type",
  "waitlist_full", "not_open", "waiver", "invalid", "generic", "offline", "origin", "slow"] as const;
export type Refusal = (typeof REFUSALS)[number];

/** A database refusal, read the way the booking app reads it (_bookRefused, _rideRuleRefusal):
 *  the code first, the detail next, the English sentence last. */
export function refusalOf(err: { code?: string; message?: string; details?: string } | null | undefined): Refusal {
  const m = `${err?.code ?? ""} ${err?.message ?? ""}`;
  const d = String(err?.details ?? "").trim();
  if (/STALE_SESSION/.test(m)) return "signin";
  if (/SESSION_CLOSED/.test(m)) return "closed";
  if (/FIX_FIRST/.test(m)) return "fix_first";
  if (/PICK_TYPE/.test(m)) return "pick_type";
  if (/NOT_OPEN_YET/.test(m)) return "not_open";
  if (/WAIVER_REQUIRED/.test(m)) return "waiver";
  if (d === "MEMBERS_ONLY" || /community members only/i.test(m)) return "members";
  if (d === "ONE_PER_SESSION" || /One place per person/i.test(m)) return "one_per_session";
  if (d === "GROUP_CAP" || /riders per booking/i.test(m)) return "group_cap";
  if (/BAD_INPUT|22023/.test(m)) return "invalid";
  return "generic";
}
