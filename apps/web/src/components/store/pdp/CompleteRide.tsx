import { serverLocalize } from "@/i18n/dicts";
import type { Store, StoreProduct } from "@/lib/store-core";
import { addonsOf, leanProduct } from "@/lib/store-sections";
import { T } from "../w3b.text";
import AddonCard from "./AddonCard";

// "Complete your ride" (F30, D17-C): a full accessories section further down the page, of the products staff paired
// with this one (goes_with: helmet, lights, Garmin), each with its own Add button. Hand-picked, never a guess, so a bad
// suggestion never teaches shoppers to skip them all. Only what can still be had; nothing when staff paired none.
export default function CompleteRide({ store, p, locale }: { store: Store; p: StoreProduct; locale: string }) {
  const list = addonsOf(store, p);
  if (!list.length) return null;
  const w = serverLocalize(T, locale);
  return (
    <section className="st-pd-sec" aria-labelledby="st-pd-ride-h">
      <h2 id="st-pd-ride-h">{p.category === "bikes" ? w.rideH : w.goesH}</h2>
      <ul className="st-pd-addons">
        {list.map((x) => <AddonCard key={x.id} p={leanProduct(x)} locale={locale} />)}
      </ul>
    </section>
  );
}
