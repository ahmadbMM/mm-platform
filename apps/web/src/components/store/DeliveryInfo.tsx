import { sar } from "@/lib/store-core";
import type { ShownOption } from "./store-data";
import type { StoreText } from "./Store.text";
import { Amt, Ic, type StoreIcon } from "./bits";

// The product page's delivery and returns: every way to have it with its fee and the dates it is expected
// on, the free-delivery threshold, and the return terms with a link to the policy. Shown before the cart, so
// nobody meets a delivery fee for the first time at checkout.
const ICON: Record<string, StoreIcon> = { pickup: "shop", jeddah: "truck", ksa: "truck" };

export default function DeliveryInfo({ t, options, freeOver, bike, returnsHref, showroom }: {
  t: StoreText; options: ShownOption[]; freeOver: number | null; bike: boolean; returnsHref: string | null; showroom: string;
}) {
  const label = (id: string) => (id === "pickup" ? t.pickup : id === "jeddah" ? t.jeddah : t.ksa);
  return (
    <section className="st-info" aria-labelledby="st-deliv-h">
      <h2 id="st-deliv-h" className="st-info-h">{t.delivery}</h2>
      <ul className="st-ways">
        {options.map((o) => (
          <li key={o.id}>
            <Ic name={ICON[o.id]} size={20} />
            <span>
              <b>{label(o.id)}</b>
              <small>{o.id === "pickup" ? showroom : o.when ? t.arrives(o.when) : ""}</small>
            </span>
            <em>{o.fee === 0 ? t.free : <Amt>{sar(o.fee)}</Amt>}</em>
          </li>
        ))}
      </ul>
      {freeOver !== null && <p className="st-info-note">{t.freeOver(sar(freeOver))}</p>}
      {bike && <p className="st-info-note">{t.bikeLocal}</p>}
      <h2 className="st-info-h st-info-h2"><Ic name="back" size={18} />{t.returnsH}</h2>
      <p className="st-info-note">{t.returns}{returnsHref && <> <a href={returnsHref}>{t.returnsLink}</a></>}</p>
    </section>
  );
}
