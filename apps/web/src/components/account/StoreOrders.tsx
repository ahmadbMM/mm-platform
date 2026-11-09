import { Link } from "@/i18n/navigation";
import { intlOf } from "@/i18n/locales";
import { sar } from "@/lib/store-core";
import { orderNo, type Order } from "@/lib/store-order";
import type { StoreText } from "@/components/store/Store.text";

// The account's online-store orders (customer_orders), newest first: the number, the day, where it is and
// the total, each opening its own page (its key is in the link, as Track order gives it).
export default function StoreOrders({ orders, t, locale }: { orders: Order[]; t: StoreText; locale: string }) {
  const day = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat(intlOf(locale), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(d);
  };
  const word = (o: Order) => (o.status === "delivered" && o.fulfil === "pickup" ? t.status.collected : t.status[o.status] ?? o.status);
  return (
    <section className="ac-panel" aria-labelledby="ac-orders-h">
      <h2 id="ac-orders-h" className="ac-panel-h">{t.yourOrders}</h2>
      <ul className="ac-list ac-purch">
        {orders.map((o) => (
          <li key={o.no}>
            <span>
              <b><Link href={`/store/order/${o.no}?k=${o.key}`}><bdi dir="ltr">{orderNo(o.no)}</bdi></Link></b>
              <small>{[day(o.created_at), word(o)].filter(Boolean).join(" · ")}</small>
            </span>
            <bdi className="tk-amt">{sar(o.total)}</bdi>
          </li>
        ))}
      </ul>
    </section>
  );
}
