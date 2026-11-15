import type { Order } from "./store-order";
import type { StoreProduct } from "./store-core";

// The store's policies as numbers the pages and the database share (CONTRACTS.md section 8): the return and exchange
// windows the one sentence states (store-policy.text.ts POLICY), and the warranty every product page states (L09). The
// words are the chains' own (their *.text.ts); these say how long.
export { POLICY } from "./store-policy.text";

/** Days from receiving it to return an item (unused, in its packaging, with the invoice), and to exchange it. */
export const RETURN_DAYS = 7;
export const EXCHANGE_DAYS = 15;

/** The least warranty the law asks for: 2 years on new goods (electrical goods now, every new good under the Consumer
 *  Protection Law of 2026), 1 year on used goods, so on a certified pre-owned bike (L09, L17, F53). */
export const LEGAL_WARRANTY_MONTHS = { new: 24, certified: 12 } as const;

/** The product's warranty in months: staff's own term when it is longer than the law's, else the law's. */
export function warrantyMonths(p: Pick<StoreProduct, "condition" | "warranty_months">): number {
  const min = LEGAL_WARRANTY_MONTHS[p.condition === "certified" ? "certified" : "new"];
  return Math.max(min, p.warranty_months ?? min);
}

/** A term in months as whole years and the months left over (24 -> {years: 2, months: 0}), for the chain's own words. */
export const warrantyParts = (months: number): { years: number; months: number } => ({ years: Math.floor(months / 12), months: months % 12 });

const DAY_MS = 24 * 3600 * 1000;
/** Whether a delivered order can still be returned (7 days) or exchanged (15 days) from the day it was delivered, with no
 *  request already open; the database decides again (store_return_request). Riyadh days: a delivery at 23:00 on the 1st
 *  can be returned until the end of the 8th. */
export function returnWindow(o: Pick<Order, "status" | "delivered_at" | "returns" | "items">, now: number): { ret: boolean; exchange: boolean } {
  const no = { ret: false, exchange: false };
  if (o.status !== "delivered" || !o.delivered_at || o.returns.some((r) => r.status === "open")) return no;
  if (!o.items.some((i) => !i.gift_card && i.id !== null)) return no;
  const at = Date.parse(o.delivered_at);
  if (!Number.isFinite(at)) return no;
  const day = (t: number) => Math.floor((t + 3 * 3600 * 1000) / DAY_MS); // Riyadh is UTC+3 all year
  const passed = day(now) - day(at);
  return { ret: passed <= RETURN_DAYS, exchange: passed <= EXCHANGE_DAYS };
}
