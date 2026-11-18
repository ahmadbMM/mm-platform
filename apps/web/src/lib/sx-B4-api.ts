import { rpcServer } from "./account";
import { payRpc, refusal } from "./pay/server";
import { payError } from "./pay/http";
import { afterOf, carOf, claimText, photoPathOk, PHOTO_MAX, type After } from "./sx-B4";

// After the sale, from this server (builder B4, 2026-11-18): the database's store_after_* functions (SX/sql/B4.sql), each
// with the server key as the store's other calls (payRpc), the order named by its number and its own key. A database
// without them answers 404: store_after_read then reads as null and the page shows none of these parts. Every answer is
// the data, or a short code the page has words for.

export type AfterAnswer<T> = { ok: true; data: T } | { ok: false; error: string; status: number };
type Rpc<T> = Awaited<ReturnType<typeof payRpc<T>>>;

const KEY32 = /^[0-9a-f]{32}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ok = (no: number, key: string) => Number.isInteger(no) && no >= 1 && no <= 999999999 && KEY32.test(key);
const bad = (error = "invalid") => ({ ok: false as const, error, status: 400 });

/** The database's own refusals of these functions, as the page's codes; the store's other ones as the store maps them. */
export const AFTER_CODES: Record<string, string> = {
  STORE_AFTER_STATE: "state", STORE_AFTER_CAR: "car", STORE_AFTER_SLOT: "slot", STORE_AFTER_CUTOFF: "cutoff",
  STORE_AFTER_SLOT_MAX: "slot_max", STORE_AFTER_SLOT_FULL: "slot_full", STORE_AFTER_CLAIM: "claim", STORE_AFTER_CLAIM_OPEN: "claim_open",
  STORE_AFTER_WARRANTY: "warranty", STORE_AFTER_PHOTOS: "photos", STORE_AFTER_TEXT: "text", STORE_AFTER_PUSH: "push_off", STORE_AFTER_BUSY: "busy",
};

export function afterError(r: { status: number; message: string }): { error: string; status: number } {
  // the function is not there yet (PostgREST's "Could not find the function ...": no code of ours before a colon)
  if (r.status === 404 && !/^[A-Z][A-Z_]{2,}$/.test(refusal(r))) return { error: "off", status: 404 };
  const mine = AFTER_CODES[refusal(r)];
  if (mine) return { error: mine, status: mine === "busy" ? 429 : 409 };
  return payError(r);
}

function answer<T>(r: Rpc<T>, good: (d: T) => boolean = (d) => d != null): AfterAnswer<T> {
  if (r.status === 200 && r.data != null && good(r.data)) return { ok: true, data: r.data };
  if (r.status === 200) return { ok: false, error: "generic", status: 502 };
  const e = afterError(r);
  return { ok: false, error: e.error, status: e.status };
}

/** The order's extras (store_after_read), or null: no such order, or a database without the function. */
export async function afterRead(no: number, key: string): Promise<After | null> {
  if (!ok(no, key)) return null;
  const r = await payRpc<unknown>("store_after_read", { p_no: no, p_track: key });
  return r.status === 200 ? afterOf(r.data) : null;
}

/** "I'm here" (N14): the customer is at the showroom, with their car's colour if they gave it. */
export async function arrive(a: { no: number; key: string; car: unknown }): Promise<AfterAnswer<After>> {
  const car = carOf(a.car);
  if (!ok(a.no, a.key)) return bad();
  if (car === null) return bad("car");
  const r = answer(await payRpc<unknown>("store_after_arrive", { p_no: a.no, p_track: a.key, p_car: car || null }));
  return mapAfter(r);
}

/** Change time (N30): the order's slot moves to another day and window the store offers. */
export async function slotChange(a: { no: number; key: string; day: string; time: string }): Promise<AfterAnswer<unknown>> {
  if (!ok(a.no, a.key) || !DAY.test(a.day) || !/^[A-Za-z0-9:_-]{1,16}$/.test(a.time)) return bad();
  return answer(await payRpc<unknown>("store_after_slot_change", { p_no: a.no, p_track: a.key, p_day: a.day, p_time: a.time }));
}

/** The handover windows a pickup can move to (B3's store_handover_slots, N13): every offered day with its open slots
 *  ({on, minutes, days: [{day, slots: [{at, to, open}]}]}); null while it is off or not there. It takes no key: it says
 *  only which slots are free. */
export async function handoverDays(): Promise<{ day: string; slots: { at: string; to: string }[] }[] | null> {
  const r = await rpcServer<unknown>("store_handover_slots", {});
  const o = r.status === 200 && r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : null;
  if (!o || o.on !== true || !Array.isArray(o.days)) return null;
  const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
  return o.days.flatMap((d) => {
    const x = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
    if (typeof x.day !== "string" || !DAY.test(x.day) || !Array.isArray(x.slots)) return [];
    const slots = x.slots.flatMap((s) => {
      const y = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
      return y.open === true && typeof y.at === "string" && HM.test(y.at) && typeof y.to === "string" && HM.test(y.to) ? [{ at: y.at, to: y.to }] : [];
    });
    return [{ day: x.day, slots }];
  });
}

/** A warranty claim from an order line (N31), with the photos this site stored in the order's folder. */
export async function claimAdd(a: { no: number; key: string; item: number; text: string; photos: unknown }): Promise<AfterAnswer<After>> {
  if (!ok(a.no, a.key) || !Number.isInteger(a.item) || a.item < 1) return bad();
  const text = claimText(a.text);
  if (!text) return bad("text");
  const photos = Array.isArray(a.photos) ? a.photos : [];
  if (photos.length > PHOTO_MAX || !photos.every((p) => photoPathOk(a.no, p))) return bad("photos");
  return mapAfter(answer(await payRpc<unknown>("store_after_claim", { p_no: a.no, p_track: a.key, p_item: a.item, p_text: text, p_photos: photos })));
}

/** Photos a return or exchange request carries (N08): put on the order's open request, after it is made. */
export async function returnPhotos(a: { no: number; key: string; photos: unknown }): Promise<boolean> {
  const photos = Array.isArray(a.photos) ? a.photos : [];
  if (!ok(a.no, a.key) || !photos.length || photos.length > PHOTO_MAX || !photos.every((p) => photoPathOk(a.no, p))) return false;
  const r = await payRpc<unknown>("store_after_return_photos", { p_no: a.no, p_track: a.key, p_photos: photos });
  return r.status === 200;
}

/** Push for this order's status (N04): on or off, for the account signed in on this browser. */
export async function pushSet(a: { no: number; key: string; on: boolean; customer: string; token: string }): Promise<AfterAnswer<After>> {
  if (!ok(a.no, a.key) || !a.customer || !a.token) return bad();
  return mapAfter(answer(await payRpc<unknown>("store_after_push", { p_no: a.no, p_track: a.key, p_on: a.on, p_id: a.customer, p_token: a.token })));
}

function mapAfter(r: AfterAnswer<unknown>): AfterAnswer<After> {
  if (!r.ok) return r;
  const v = afterOf(r.data);
  return v ? { ok: true, data: v } : { ok: false, error: "generic", status: 502 };
}
