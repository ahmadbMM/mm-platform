import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { serverLocalize } from "@/i18n/dicts";
import { intlOf } from "@/i18n/locales";
import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { rpcServer } from "@/lib/account";
import { fmtRange, type Fulfil } from "@/lib/store-delivery";
import { pick, type StoreProduct } from "@/lib/store-core";
import { checkupWeeks, fleetRecordOf, orderByDays, orderByOf, presetOf, rodeOf } from "@/lib/sx-B2";
import { T } from "./sx-B2.text";
import { B2Icon } from "./sx-B2-icons";
import type { StoreState } from "./store-data";

// The product page's server half from the "do all" build of 2026-11-18 (builder B2): what the top of the page adds to
// pdp-top.ts's props. Everything a database may not have yet is optional: a function that is missing answers 404 and
// its line is simply not drawn.
//   N09: the size and colour an address asks for (?size=M&colour=Black: a showroom tag or QR, a shared link).
//   N12: "First check-up free within 12 weeks" on a bike (site_content store.checkup).
//   N36: "Order by <date> for Eid delivery" in a way's label while staff's date makes it true (store.orderBy).
//   N16: "You've ridden this type on 4 Saturday rides" for the signed-in rider (store_rode_type), and
//   N25: an ex-rental bike's rides and months in the fleet (store_fleet_record): both streamed in after the page, so a
//   slow answer never holds the page up.
export type B2Top = {
  preset: { size: string | null; colour: string | null };
  checkup: number | null;
  orderBy: Partial<Record<Fulfil, string>>;
  /** The streamed fact rows (<li>), each drawing nothing when it has nothing true to say. */
  facts: ReactNode;
};

export function b2Top(s: StoreState, p: StoreProduct, locale: string, q: Record<string, string | string[] | undefined>): B2Top {
  const t = serverLocalize(T, locale);
  const bike = p.category === "bikes";
  const occ = orderByOf(s.content);
  const what = occ ? pick(locale, occ.en, occ.ar) : "";
  const days = orderByDays(occ, s.settings, s.today);
  const orderBy: Partial<Record<Fulfil, string>> = {};
  for (const [k, d] of Object.entries(days) as [Fulfil, string][]) {
    const day = fmtRange({ from: d, to: d }, intlOf(locale));
    orderBy[k] = k === "pickup" ? t.orderByPickup(day, what) : t.orderBy(day, what);
  }
  return {
    preset: presetOf(p, q),
    checkup: bike ? checkupWeeks(s.content) : null,
    orderBy,
    facts: bike ? (
      <>
        {p.condition === "certified" && <Suspense fallback={null}><FleetLine product={p.id} locale={locale} /></Suspense>}
        <Suspense fallback={null}><RodeLine product={p.id} locale={locale} /></Suspense>
      </>
    ) : null,
  };
}

/** N25: a certified pre-owned bike staff linked to its fleet bike: its rides and its months in the fleet, real records
 *  only (the database counts them; nothing when the product is not linked). */
async function FleetLine({ product, locale }: { product: string; locale: string }) {
  const r = await rpcServer<unknown>("store_fleet_record", { p_product: product }, 3000);
  const rec = r.status === 200 ? fleetRecordOf(r.data) : null;
  if (!rec) return null;
  return <li className="st-b2-fact"><B2Icon name="history" /><span>{serverLocalize(T, locale).fleet(rec.rides, rec.months)}</span></li>;
}

/** N16: the signed-in rider's own Saturday rides on this bike's type (matched by type: the fleet's models are not the
 *  store's). Only a request that carries the account's cookie asks; the answer is the rider's own count, nothing else. */
async function RodeLine({ product, locale }: { product: string; locale: string }) {
  const sess = decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
  if (!sess) return null;
  const r = await rpcServer<unknown>("store_rode_type", { p_id: sess.id, p_token: sess.token, p_product: product }, 3000);
  const n = r.status === 200 ? rodeOf(r.data) : null;
  if (n === null) return null;
  return <li className="st-b2-fact"><B2Icon name="bike" /><span>{serverLocalize(T, locale).rode(n)}</span></li>;
}
