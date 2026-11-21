// Changing a booking on the website, as the booking app's Bookings section changes one (the user, 2026-11-19: "make sure
// all customers can do everything they want in the booking app to do it on the main website"): Cancel with its reasons
// (showCancelReasonModal, confirmCancelWithReason, cancelBooking), Edit (submitModifyBooking, _modEntries, _modNameLocked),
// the Farm House Night's family (_fhDropOpen, _fhDrop), the add-ons (renderAddonPicker, _entryAddonMutate), Reschedule
// (showRescheduleModal, rescheduleBooking, _rsTarget, _rsRefused) and the lockers (_lkTkHtml, _lkTkRemove, _lkReviewHtml,
// _lkCabHtml, _lkAfterBook, _lkRiderSay). The plain rules live here, so the browser's dialogs (components/booking/
// TicketManage.tsx) and the server's routes (app/api/booking/*, lib/booking-manage-server.ts) answer every question the
// same way, and so they can be tested. Nothing here imports the server: the dialogs read it too. The database stays the
// authority: customer_booking_update, customer_create_booking, customer_addon_stock and the customer_locker_* functions
// refuse whatever these rules let through by mistake.

type Row = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const N = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
export const ID = /^[A-Za-z0-9_-]{1,64}$/;

// ── A booking's live rows ──────────────────────────────────────────────────────────────────────────

/** One add-on line as the database keeps it on a row (the booking app's entryAddons): the item, how many, and `p`, the
 *  price each was sold at when the database stamped it. The locker's fee is a line too ({id: "locker"}), which the
 *  database writes and the page never does. */
export type RawAddon = { id: string; qty: number; p?: number };
export const LOCKER_LINE = "locker";

/** A booking's add-on lines as stored: a JSON list or its text, of {id, qty, p?} or of bare ids (the old way). */
export function rawAddons(v: unknown): RawAddon[] {
  let raw: unknown = v;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
  const out: RawAddon[] = [];
  for (const a of Array.isArray(raw) ? raw : []) {
    const o = a && typeof a === "object" ? (a as Row) : null;
    const id = o ? S(o.id) : S(a);
    if (!id) continue;
    const qty = o ? Math.max(1, Math.floor(Number(o.qty)) || 1) : 1;
    const p = o && typeof o.p === "number" && Number.isFinite(o.p) ? o.p : undefined;
    out.push(p === undefined ? { id, qty } : { id, qty, p });
  }
  return out;
}

/** A live row of the account's booking, as the dialogs and the routes read it (my_bookings' row). */
export type ManageRow = {
  id: string; sessionId: string; date: string; name: string; status: "waiting" | "waitlist"; queueNum: number | null;
  type: string; height: number | null; size: string; paid: boolean; price: number; promo: string | null; payMethod: string | null;
  walletPaid: number; addons: RawAddon[];
};

/** A my_bookings row as a live row (waiting or on the waitlist), or null for any other. */
export function manageRow(r: Row): ManageRow | null {
  const status = r.status === "waiting" || r.status === "waitlist" ? r.status : null;
  const date = S(r.session_date).slice(0, 10);
  if (!status || !ID.test(S(r.id)) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const h = N(r.height);
  return {
    id: S(r.id), sessionId: S(r.session_id) || date, date, name: S(r.name), status, queueNum: N(r.queue_num),
    type: S(r.type_preference), height: h !== null && Number.isInteger(h) ? h : null, size: S(r.size), paid: r.paid === true, price: N(r.price) ?? 0,
    promo: S(r.promo_code) || null, payMethod: S(r.pay_method) || null, walletPaid: N(r.wallet_paid) ?? 0, addons: rawAddons(r.addons),
  };
}

/** The booking's own live rows on a session, in ONE order for the edit form and its save (_modEntries): the queue number,
 *  then the id. The form used to take them in whatever order the rows came, and a save with nothing changed could hand
 *  the account holder the co-rider's bike type and height. */
export function liveRows(rows: Row[], sessionId: string): ManageRow[] {
  return rows.map(manageRow).filter((r): r is ManageRow => !!r && r.sessionId === sessionId)
    .sort((a, b) => ((a.queueNum ?? 0) - (b.queueNum ?? 0)) || a.id.localeCompare(b.id));
}

/** The account's rows on the session that are out on the ride (active): an edit counts them against the cap (_jccBooked). */
export const activeCount = (rows: Row[], sessionId: string) =>
  rows.filter((r) => r.status === "active" && (S(r.session_id) || S(r.session_date).slice(0, 10)) === sessionId).length;

/** Whether the session is over at `now` (Riyadh, "YYYY-MM-DDTHH:MM"), as the booking app's _sessEnded reads it: a day
 *  gone is over; on its day, from the end of its window ("09:00 - 11:00" when it has none); an end written before its start
 *  is on the next day. */
export function sessionEnded(date: string, times: readonly [string, string] | null, now: string): boolean {
  const d = date.slice(0, 10), today = now.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d > today) return false;
  const next = new Date(Date.parse(`${d}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);
  if (next < today) return true;
  const hm = (x: string | undefined) => (x && /^\d{1,2}:\d{2}$/.test(x) ? x.padStart(5, "0") : "");
  const start = hm(times?.[0]) || "09:00", end = hm(times?.[1]) || (times ? start : "11:00");
  const endDay = end < start ? next : d;
  if (endDay !== today) return endDay < today;
  return now.slice(11, 16) >= end;
}

// ── Cancel ─────────────────────────────────────────────────────────────────────────────────────────

/** The rider's reasons, each saved on the booking as a short code (queue_entries.cancel_reason), in the booking app's
 *  order (CANCEL_REASONS); "other" carries the rider's own words (cancel_note). Settings > Business hides some and adds
 *  the admins' own (lib/biz.ts bizOf: cancelOff, cancelCustom; the booking app's _bizCancel). */
export const CANCEL_REASONS = ["plans", "work", "unwell", "weather", "wrong_date", "transport", "group", "price", "other"] as const;
export type BuiltInReason = (typeof CANCEL_REASONS)[number];
export const CANCEL_OTHER = "other";
/** A reason as the dialog lists it: a built-in one by its code (the words file names it), an admin's with its label. */
export type Reason = { code: string; label?: string };
export function cancelReasons(off: readonly string[] = [], custom: readonly (readonly [string, string])[] = []): Reason[] {
  const hide = new Set(off.filter((x) => x !== CANCEL_OTHER));
  const base: Reason[] = CANCEL_REASONS.filter((c) => c !== CANCEL_OTHER && !hide.has(c)).map((code) => ({ code }));
  const mine: Reason[] = custom.filter(([c, l]) => /^[a-z_]{1,24}$/.test(c) && !!l.trim()).slice(0, 20).map(([code, label]) => ({ code, label: label.trim().slice(0, 60) }));
  return [...base, ...mine, { code: CANCEL_OTHER }];
}
export const NOTE_MAX = 300;
/** What the cancel's body says, cleaned: the booking (any of its rows), the reason's code, and Other's words. Null when it
 *  cannot be read; a reason this list does not hold is the route's to refuse. */
export function cancelBody(b: unknown): { booking: string; reason: string; note: string | null } | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Row;
  const booking = S(o.booking), reason = S(o.reason);
  if (!ID.test(booking) || !/^[a-z_]{1,24}$/.test(reason)) return null;
  if (o.note != null && typeof o.note !== "string") return null;
  const note = S(o.note).replace(/\s+/g, " ").trim().slice(0, NOTE_MAX) || null;
  if (reason === CANCEL_OTHER && !note) return null; // Other needs its words (cancelReasonWrite)
  return { booking, reason, note: reason === CANCEL_OTHER ? note : null };
}
/** The cancel's write, the same for every rider of the booking (the reason rides on the cancel itself). */
export const cancelPatch = (reason: string, note: string | null): Row =>
  ({ status: "cancelled", assigned_bike_id: null, cancel_reason: reason, ...(reason === CANCEL_OTHER && note ? { cancel_note: note } : {}) });
/** A paid ride that is over is settled at close-out, not cancelled by the rider (customer_booking_update refuses it): said
 *  in words before anything is sent. A move of it is refused the same way (20261119000200). */
export const paidOver = (rows: Pick<ManageRow, "paid" | "walletPaid">[], ended: boolean) => ended && rows.some((r) => r.paid || r.walletPaid > 0);
/** The stock a booking leaving its place gives back (_restockAddonsOnExit): each row that held its place ('waiting': a
 *  waitlisted row never took any) gives its add-ons back, summed by item. The locker's line is no stock. */
export function stockBack(rows: Pick<ManageRow, "status" | "addons">[]): { id: string; delta: number }[] {
  const by = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== "waiting") continue;
    for (const a of r.addons) if (a.id !== LOCKER_LINE) by.set(a.id, (by.get(a.id) ?? 0) + a.qty);
  }
  return [...by].filter(([, n]) => n > 0).map(([id, n]) => ({ id, delta: Math.min(20, n) }));
}

// ── Edit ───────────────────────────────────────────────────────────────────────────────────────────

/** While editing, a rider who is already on the booking keeps their name: rider 1 is the account holder, and a
 *  customer's own update never renames a rider (_modNameLocked). Riders being added type theirs. */
export const nameLocked = (i: number, existing: number) => i < existing;
/** One rider as the edit form holds them: the name (an added rider's), the height and the bike type. */
export type EditRider = { name: string; height: string; type: string };
export const KIDS_MAX_CM = 144;
/** Heights as typed: Arabic-Indic and Persian digits read as ASCII (the booking app's _asciiDigits). */
export const digits = (s: string) => s.replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)));
export const heightOkCm = (v: string) => { const h = Number(digits(String(v).trim())); return Number.isInteger(h) && h >= 100 && h <= 250; };
/** The frame size the owner's chart gives (lib/booking.ts heightToSize, repeated here so the browser reads no server file). */
export function sizeFor(h: number, type: string): string {
  if (!(h > 0) || h <= KIDS_MAX_CM) return "";
  const chart: [number, string][] = type === "Hybrid" || type === "Mountain" ? [[159, "XS"], [170, "S"], [185, "M"], [Infinity, "L"]] : [[159, "XS"], [172, "S"], [179, "M"], [189, "L"], [Infinity, "XL"]];
  return (chart.find(([max]) => h <= max) as [number, string])[1];
}
/** A typed name as the database takes one: a dash becomes a space, letters and spaces (and a name's periods) only. */
export const cleanRiderName = (s: string) =>
  s.replace(/[-‐-―_]/g, " ").replace(/[^\p{L}\p{M}\s.]/gu, "").replace(/\.{2,}/g, ".").replace(/(^|\s)\.+/g, "$1").replace(/\s+/g, " ").trim().slice(0, 60);
/** An added rider's name as the booking app saves one (_titleCaseName): each word's first letter in capitals. */
export const titleCase = (s: string) => s.replace(/(^|[\s.])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase());
/** A name the database takes for a rider (_name_chars_ok, _name_parts_ok) and the app's own check (_vBlur): a first and
 *  last name, each part at least two letters. */
export const riderNameOk = (s: string) => /\p{L}/u.test(s) && s.split(/[\s.]+/).filter(Boolean).every((w) => [...w].length >= 2) && s.split(/\s+/).filter(Boolean).length >= 2;

/** What the edit form shows for the session (the manage read): the bike to size or not, whether the party's size may
 *  change (_partyRide or a ride nobody approves), the most riders it may hold, and the pills. */
export type EditType = { type: string; price: number | null; closed: boolean };
export type EditError =
  | { i: number; field: "height" | "type" | "kids" | "name" | "paid" | "closed" }
  | { i: -1; field: "cap" | "changed" | "waiver" };

/** The edit form's checks, in the app's order (validateRegInputs, then submitModifyBooking's): each height, then each type
 *  (none of "Any", a closed type only where the row already holds it, a Kids bike only up to 144 cm), each added rider's
 *  name, a paid row moved to a dearer bike (errPaidTypeDesk: fare against the greater of the old fare and what was paid),
 *  the waiver for riders added. Null when all is well. `fare` gives a type's fare on the session (null when unknown). */
export function checkEdit(o: {
  existing: Pick<ManageRow, "type" | "paid" | "price" | "promo">[]; riders: EditRider[]; bike: boolean; cap: number;
  types: readonly EditType[]; fare: (type: string) => number | null; waiver: boolean;
}): EditError | null {
  const { existing, riders, bike } = o;
  if (riders.length < 1 || riders.length > Math.max(o.cap, existing.length)) return { i: -1, field: "cap" };
  if (bike) {
    for (let i = 0; i < riders.length; i++) if (!heightOkCm(riders[i].height)) return { i, field: "height" };
    for (let i = 0; i < riders.length; i++) {
      const ty = riders[i].type, kept = i < existing.length && existing[i].type === ty;
      const pill = o.types.find((x) => x.type === ty);
      if (!ty || ty === "Any" || ty === "None" || (!pill && !kept)) return { i, field: "type" };
      if (pill?.closed && !kept) return { i, field: "closed" };
      if (ty === "Kids" && Number(digits(riders[i].height)) > KIDS_MAX_CM) return { i, field: "kids" };
    }
  }
  for (let i = existing.length; i < riders.length; i++) if (riders.length > 1 && !riderNameOk(cleanRiderName(riders[i].name))) return { i, field: "name" };
  if (bike) {
    for (let i = 0; i < Math.min(riders.length, existing.length); i++) {
      const e = existing[i], ty = riders[i].type;
      const house = e.paid && e.price === 0 && !e.promo;
      if (!e.paid || house || e.type === ty) continue;
      const now = o.fare(ty), was = o.fare(e.type);
      if (now != null && now > Math.max(was ?? 0, e.price)) return { i, field: "paid" };
    }
  }
  if (riders.length > existing.length && !o.waiver) return { i: -1, field: "waiver" };
  return null;
}

/** The edit's writes (submitModifyBooking): each row kept gets only what changed (its height, the size that follows, its
 *  type; never a price, which the database sets, nor a name, which a customer's update does not write); the riders past
 *  the new count are cancelled, the last first in the list; the riders past the old count are new bookings. */
export function editPlan(existing: ManageRow[], riders: EditRider[], bike: boolean): { patches: { id: string; patch: Row; ownSwitch: boolean; paidSwitch: boolean; typeSwitch: boolean }[]; removed: ManageRow[]; added: EditRider[] } {
  const patches: { id: string; patch: Row; ownSwitch: boolean; paidSwitch: boolean; typeSwitch: boolean }[] = [];
  for (let i = 0; i < Math.min(riders.length, existing.length); i++) {
    const e = existing[i];
    if (!bike) continue; // a seat keeps its 'None': nothing of it changes here
    const ty = riders[i].type, h = Number(digits(riders[i].height.trim()));
    const patch: Row = {};
    if (Number.isInteger(h) && h !== e.height) patch.height = h;
    if (Number.isInteger(h) && (h !== e.height || ty !== e.type) && sizeFor(h, ty) !== e.size) patch.size = sizeFor(h, ty);
    if (ty !== e.type) patch.type_preference = ty;
    if (Object.keys(patch).length) {
      const house = e.paid && e.price === 0 && !e.promo;
      patches.push({ id: e.id, patch, ownSwitch: e.type === "Own" && ty !== "Own", paidSwitch: e.paid && !house && ty !== e.type, typeSwitch: ty !== e.type && e.type !== "Own" && ty !== "Own" });
    }
  }
  return {
    patches,
    removed: riders.length < existing.length ? existing.slice(riders.length) : [],
    added: riders.slice(existing.length).map((r) => ({ ...r, name: titleCase(cleanRiderName(r.name)), height: digits(r.height.trim()) })),
  };
}

/** What the edit's body says, cleaned: the session, the rows the form was filled from (`key`, so a booking that changed
 *  underneath is filled again: modifyChangedMsg), each rider, and the waiver's tick for riders added. */
export function editBody(b: unknown): { session: string; key: string[]; riders: EditRider[]; waiver: boolean } | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Row;
  const session = S(o.session);
  if (!ID.test(session) || !Array.isArray(o.key) || !Array.isArray(o.riders)) return null;
  const key = o.key.filter((x): x is string => typeof x === "string" && ID.test(x));
  if (key.length !== o.key.length || key.length < 1 || key.length > 20 || o.riders.length < 1 || o.riders.length > 20) return null;
  const riders: EditRider[] = [];
  for (const x of o.riders) {
    if (!x || typeof x !== "object") return null;
    const r = x as Row;
    riders.push({ name: S(r.name).slice(0, 80), height: S(r.height).slice(0, 4), type: S(r.type).slice(0, 20) });
  }
  return { session, key, riders, waiver: o.waiver === true };
}

/** The Farm House Night's holder (_fhHolderId): the row named as the account, else the first. Never dropped alone. */
export function holderOf(rows: Pick<ManageRow, "id" | "name">[], account: string): string | null {
  const nm = account.trim().toLowerCase();
  return (rows.find((r) => r.name.trim().toLowerCase() === nm) ?? rows[0])?.id ?? null;
}

// ── Add-ons ────────────────────────────────────────────────────────────────────────────────────────

/** A rider's own booking paid at the desk, by card or online takes no more of a priced add-on: it stays paid, so nobody
 *  would collect it (_adPaidLock). Paid from the wallet or on the house, it still may. */
export const paidLock = (r: Pick<ManageRow, "paid" | "payMethod" | "price" | "promo">) => r.paid && r.payMethod !== "wallet" && !(r.price === 0 && !r.promo);
export const ADDON_MAX = 20;
export type AddonRefusal = "out" | "paid" | "max" | "handed" | "none" | "off";
/** One unit of an item added (+1) or taken off (-1) on a row (_entryAddonMutate): a unit added goes on a line at today's
 *  price (one with no price yet, or a new one), never on an older line sold at another; a unit taken off comes off the
 *  last line, the one added most recently. `item` is the inventory's row (null when it is gone), `sold` whether the
 *  session still sells it, `active` whether the row is out on the ride. */
export function addonStep(lines: RawAddon[], itemId: string, delta: 1 | -1, o: { item: { price: number; qty: number } | null; sold: boolean; row: Pick<ManageRow, "paid" | "payMethod" | "price" | "promo">; active: boolean }): { lines: RawAddon[] } | { error: AddonRefusal } {
  const cur = lines.map((x) => ({ ...x }));
  const mine = cur.filter((x) => x.id === itemId);
  if (delta > 0) {
    if (!o.item || !o.sold) return { error: "off" };
    if (o.item.qty <= 0) return { error: "out" };
    if (o.item.price > 0 && paidLock(o.row)) return { error: "paid" };
    if (mine.reduce((n, x) => n + x.qty, 0) >= ADDON_MAX) return { error: "max" };
    const a = mine.find((x) => x.p === undefined || x.p === o.item!.price);
    if (a) a.qty += 1; else cur.push({ id: itemId, qty: 1 });
    return { lines: cur };
  }
  const a = mine[mine.length - 1];
  if (!a) return { error: "none" };
  if (o.active) return { error: "handed" };
  a.qty -= 1;
  return { lines: a.qty <= 0 ? cur.filter((x) => x !== a) : cur };
}
/** How many of an item a row holds, every line of it. */
export const addonQty = (lines: RawAddon[], id: string) => lines.filter((x) => x.id === id).reduce((n, x) => n + x.qty, 0);

// ── Reschedule ─────────────────────────────────────────────────────────────────────────────────────

/** A session a booking may be moved to (_rsTarget, 2026-10-05): another open circuit ride (no community ride, Petromin
 *  night, event, workshop or National Day ride), one nobody approves, not over, already open to riders (the booking
 *  window, and members book first for a rider who is not one), and one the account's gender may book. */
export function rsTarget(s: { id: string; kind: string; full: boolean; fbk?: boolean; approval?: boolean; members?: boolean; free?: boolean; date: string }, fromId: string,
  o: { ended: boolean; notOpen: boolean; mfHeld: boolean; genderOk: boolean; community: boolean }): boolean {
  return s.id !== fromId && !s.full && !s.fbk && !s.approval && !o.community && s.kind === "jcc" && !o.ended && !o.notOpen && !o.mfHeld && o.genderOk;
}
/** A move the server refused, as the booking app says it (_rsRefused): a members-only ride, one not open yet, members book
 *  first, a paid booking onto a ride with another fare (PAID_MOVE), a type closed or full there. */
export type MoveRefusal = "members" | "not_open" | "members_first" | "paid_move" | "type_closed" | "type_full" | "no_room" | "closed" | "generic";
export function moveRefusal(err: { code?: string; message?: string; details?: string } | null | undefined): MoveRefusal {
  const m = `${err?.code ?? ""} ${err?.message ?? ""} ${err?.details ?? ""}`;
  if (/MEMBERS_ONLY|community members only/i.test(m)) return "members";
  if (/NOT_OPEN_YET/.test(m)) return "not_open";
  if (/MEMBERS_FIRST/.test(m)) return "members_first";
  if (/PAID_MOVE/.test(m)) return "paid_move";
  if (/TYPE_CLOSED/.test(m)) return "type_closed";
  if (/TYPE_FULL/.test(m)) return "type_full";
  if (/SESSION_CLOSED/.test(m)) return "closed";
  return "generic";
}

// ── Lockers ────────────────────────────────────────────────────────────────────────────────────────

/** A locker is rented for an evening's time (the owner, 2026-11-09): early (6-8 PM) or late (9-11 PM) or both on a JCC
 *  night, pm (7-9 PM) on a Petromin night. Each time holds its slots: e, l or both. */
export type LkPeriod = "early" | "late" | "both" | "pm";
export const LK_TIMES: Record<LkPeriod, [string, string]> = { early: ["18:00", "20:00"], late: ["21:00", "23:00"], both: ["18:00", "23:00"], pm: ["19:00", "21:00"] };
export const LK_SLOTS: Record<LkPeriod, ("e" | "l")[]> = { early: ["e"], late: ["l"], both: ["e", "l"], pm: ["e", "l"] };
export const isLkPeriod = (v: unknown): v is LkPeriod => v === "early" || v === "late" || v === "both" || v === "pm";
export const lkPeriods = (kind: string): LkPeriod[] => (kind === "pm" ? ["pm"] : kind === "jcc" ? ["early", "late", "both"] : []);

/** What a session offers (customer_locker_offer): its kind ('' for none), the fee for one time and for both, the places left
 *  for each time and the times already over tonight. Null when the answer is not one. */
export type LkOffer = { kind: "jcc" | "pm"; one: number; both: number; left: Record<LkPeriod, number>; ended: Record<LkPeriod, boolean> };
export function lkOffer(v: unknown): LkOffer | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Row;
  if (o.kind !== "jcc" && o.kind !== "pm") return null;
  const left = (o.left && typeof o.left === "object" ? o.left : {}) as Row, ended = (o.ended && typeof o.ended === "object" ? o.ended : {}) as Row;
  const ps: LkPeriod[] = ["early", "late", "both", "pm"];
  return {
    kind: o.kind, one: N(o.one) ?? 0, both: N(o.both) ?? 0,
    left: Object.fromEntries(ps.map((p) => [p, Math.max(0, Math.floor(N(left[p]) ?? 0))])) as Record<LkPeriod, number>,
    ended: Object.fromEntries(ps.map((p) => [p, ended[p] === true])) as Record<LkPeriod, boolean>,
  };
}
/** The evening's cabinet (locker_board, anyone may read it): its doors (out of service or not) and the numbers taken in
 *  each slot, never by whom. Null when the answer is not one. */
export type LkBoard = { units: { code: string; out: boolean }[]; taken: { e: string[]; l: string[] } };
export function lkBoard(v: unknown): LkBoard | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Row;
  if (!o.kind || !Array.isArray(o.units)) return null;
  const units = (o.units as Row[]).filter((u) => u && /^[1-9]\d{0,3}$/.test(S(u.code))).map((u) => ({ code: S(u.code), out: u.out === true }));
  const tk = (o.taken && typeof o.taken === "object" ? o.taken : {}) as Row;
  const list = (x: unknown) => (Array.isArray(x) ? x.map((c) => S(c)).filter(Boolean) : []);
  return { units, taken: { e: list(tk.e), l: list(tk.l) } };
}
/** The numbers taken for a time (_lkTakenFor). On a change, the rental's own door for its own time is not taken from it. */
export function lkTaken(b: LkBoard, p: LkPeriod, mine?: { period: LkPeriod; code: string | null } | null): Set<string> {
  const own = mine?.code ? new Set(LK_SLOTS[mine.period]) : new Set<string>();
  const out = new Set<string>();
  for (const s of LK_SLOTS[p]) for (const c of b.taken[s]) if (!(c === mine?.code && own.has(s))) out.add(c);
  return out;
}
/** The cabinet as it stands (_lkCabHtml): a door per number from 1 to the highest, a gap (null) where a number is missing;
 *  three across, numbered across the rows, never mirrored right to left. */
export function lkDoors(b: LkBoard): ({ code: string; out: boolean } | null)[] {
  const by = new Map(b.units.map((u) => [u.code, u]));
  const hi = b.units.reduce((m, u) => Math.max(m, Number(u.code)), 0);
  return Array.from({ length: hi }, (_, i) => by.get(String(i + 1)) ?? null);
}
/** The fee for a time (the offer's one or both). */
export const lkFee = (o: Pick<LkOffer, "one" | "both">, p: LkPeriod) => (p === "both" ? o.both : o.one);
/** A locker the server refused, as the booking app says it (_lkRiderSay): the time full, the door just taken, the time
 *  over, or not open to this booking. */
export type LkRefusal = "full" | "taken" | "ended" | "not_open" | "generic";
export function lkRefusal(err: { code?: string; message?: string } | null | undefined): LkRefusal {
  const m = `${err?.code ?? ""} ${err?.message ?? ""}`;
  return /LOCKERS_FULL/.test(m) ? "full" : /LOCKER_TAKEN|LOCKER_OUT/.test(m) ? "taken" : /LOCKER_ENDED/.test(m) ? "ended" : /LOCKER_/.test(m) ? "not_open" : "generic";
}
/** A locker rental of the account's (customer_lockers): on a booking of its own, or none. */
export type LkRental = { id: string; bookingId: string | null; day: string; period: LkPeriod; code: string | null; status: string; price: number; billPaid: boolean };
export function lkRentals(v: unknown): LkRental[] {
  if (!Array.isArray(v)) return [];
  const out: LkRental[] = [];
  for (const x of v as Row[]) {
    if (!x || typeof x !== "object" || !S(x.id) || !isLkPeriod(x.period) || x.status === "cancelled") continue;
    out.push({ id: S(x.id), bookingId: S(x.booking_id) || null, day: S(x.day).slice(0, 10), period: x.period, code: S(x.code) || null, status: S(x.status), price: N(x.price) ?? 0, billPaid: x.bill_paid === true });
  }
  return out;
}
/** The locker body's actions, cleaned (app/api/booking/locker): the evening's cabinet, a reservation on bookings, a change
 *  of a rental's time or door, a removal. Null when it cannot be read. */
export type LockerBody =
  | { action: "board"; session: string; day: string }
  | { action: "reserve"; ids: string[]; period: LkPeriod; codes: string[] | null }
  | { action: "change"; rental: string; period: LkPeriod; code: string }
  | { action: "cancel"; ids: string[] };
const DOOR = /^[1-9]\d{0,3}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function lockerBody(b: unknown): LockerBody | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Row;
  const ids = (v: unknown) => (Array.isArray(v) && v.length >= 1 && v.length <= 20 && v.every((x) => typeof x === "string" && ID.test(x)) ? [...new Set(v as string[])] : null);
  if (o.action === "board") return ID.test(S(o.session)) && /^\d{4}-\d{2}-\d{2}$/.test(S(o.day)) ? { action: "board", session: S(o.session), day: S(o.day) } : null;
  if (o.action === "reserve") {
    const list = ids(o.ids);
    if (!list || !isLkPeriod(o.period)) return null;
    if (o.codes == null) return { action: "reserve", ids: list, period: o.period, codes: null };
    if (!Array.isArray(o.codes) || !o.codes.every((c) => typeof c === "string" && DOOR.test(c)) || new Set(o.codes).size !== o.codes.length || o.codes.length !== list.length) return null;
    return { action: "reserve", ids: list, period: o.period, codes: o.codes as string[] };
  }
  if (o.action === "change") return UUID.test(S(o.rental)) && isLkPeriod(o.period) && DOOR.test(S(o.code)) ? { action: "change", rental: S(o.rental), period: o.period, code: S(o.code) } : null;
  if (o.action === "cancel") { const list = ids(o.ids); return list ? { action: "cancel", ids: list } : null; }
  return null;
}

// ── The answers ────────────────────────────────────────────────────────────────────────────────────

/** Every refusal the dialogs word (in the booking app's words, components/booking/Manage.words.ts). */
export type ManageError =
  | "origin" | "signin" | "invalid" | "busy" | "generic" | "closed" | "over" | "gone" | "changed" | "waiver" | "waiver_outdated"
  | "fix_first" | "waitlist_full" | "type_closed" | "type_full" | "paid_type" | "own_full" | "cap" | "members_first" | "not_open"
  | "members" | "paid_move" | "no_room" | "split" | "out" | "paid" | "max" | "handed" | "off" | "none"
  | "lk_full" | "lk_taken" | "lk_ended" | "lk_not_open";
