import { Link } from "@/i18n/navigation";
import { intlOf } from "@/i18n/locales";
import { sized } from "@/lib/img";
import { sar } from "@/lib/store-core";
import { orderNo, orderSteps, paidWith, payable, reportable, unpaidCancel, type Order } from "@/lib/store-order";
import type { StoreText } from "./Store.text";
import { Amt, Ic, NoPhoto, WhatsAppMark } from "./bits";
import { CopyNo, PrintButton, PutBack } from "./OrderActions";

// An order's page: confirmation, tracking and the invoice in one, to keep or print. The number to copy, where
// the order is (paid, preparing, ready or on its way, then collected or delivered), when it is expected, the
// courier's tracking number once it is sent, every line and amount with the VAT in it, how it was paid, the
// seller's VAT and CR numbers, what happened to it, and the return terms. An unpaid order offers its payment
// while the items are held; one that was never paid can put its items back in the cart.
export type Seller = { trade: string; legal: string; vat: string; cr: string };

export default function OrderView({ o, t, locale, seller, now, whatsapp, showroom, expected, signup, returnsHref }: {
  o: Order; t: StoreText; locale: string; seller: Seller; now: number; whatsapp: string; showroom: string;
  expected: string | null; signup: string | null; returnsHref: string | null;
}) {
  const no = orderNo(o.no);
  const when = (iso: string | null) => {
    if (!iso || !Number.isFinite(Date.parse(iso))) return "";
    return new Intl.DateTimeFormat(intlOf(locale), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Riyadh" }).format(new Date(iso));
  };
  const statusWord = (st: string) => (st === "delivered" && o.fulfil === "pickup" ? t.status.collected : t.status[st] ?? st);
  const { steps, at } = orderSteps(o);
  const card = paidWith(o.payment);
  const cardPart = Math.round((o.total - o.wallet_paid) * 100) / 100;
  const way = o.fulfil === "pickup" ? t.pickup : o.fulfil === "jeddah" ? t.jeddah : t.ksa;
  const wa = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(t.mistakeMsg(no))}` : null;

  return (
    <div className="st st-order">
      <header className="st-ord-head">
        <p className="st-eyebrow">{t.orderNo}</p>
        <div className="st-ord-no"><h1><bdi dir="ltr">{no}</bdi></h1><CopyNo text={no} /></div>
        <p className={`st-badge s-${o.status}`}>{statusWord(o.status)}</p>
        {["paid", "preparing", "ready", "shipped", "delivered"].includes(o.status) && <p className="st-thanks">{t.thanks}</p>}
      </header>

      {o.status === "pending" && (
        <section className="st-alert" aria-labelledby="st-pay-h">
          <h2 id="st-pay-h">{t.status.pending}</h2>
          {payable(o, now) && o.payment ? (
            <>
              <p>{t.holdUntil(when(o.payment.expires_at))}</p>
              <a className="bk-btn" href={`/pay/${o.payment.id}`}><Ic name="lock" size={17} />{t.payNow} <Amt>{sar(o.payment.amount)}</Amt></a>
            </>
          ) : <p>{t.unpaid}</p>}
        </section>
      )}
      {o.status === "cancelled" && (
        <section className="st-alert warn">
          <h2>{t.cancelledMsg}</h2>
          {unpaidCancel(o) && <p>{t.unpaid}</p>}
          {unpaidCancel(o) && o.items.some((i) => i.variant_id) && <PutBack items={o.items.filter((i) => i.variant_id).map((i) => ({ variant: i.variant_id as string, qty: i.qty }))} />}
        </section>
      )}
      {o.status === "refunded" && <section className="st-alert warn"><h2>{t.refundedMsg}</h2></section>}

      {at !== null && at >= 0 && (
        <ol className="st-steps" aria-label={t.progress}>
          {steps.map((st, i) => (
            <li key={st} className={i <= at ? "done" : undefined} aria-current={i === at ? "step" : undefined}>
              <span className="st-step-dot">{i <= at && <Ic name="tick" size={14} />}</span>
              <span>{t.status[st]}</span>
            </li>
          ))}
        </ol>
      )}

      <section className="st-ord-way" aria-label={way}>
        <p><Ic name={o.fulfil === "pickup" ? "shop" : "truck"} size={20} /><b>{way}</b></p>
        {o.fulfil === "pickup" ? <p>{t.collectFrom(showroom)}</p>
          : o.address && <p>{t.deliverTo}: {[o.address.district, o.address.city].filter(Boolean).join(", ")}</p>}
        {expected && <p className="st-expected">{t.expected(expected)}</p>}
        {(o.courier || o.tracking_no) && (
          <dl className="st-kv">
            {o.courier && <div><dt>{t.courier}</dt><dd>{o.courier}</dd></div>}
            {o.tracking_no && <div><dt>{t.tracking}</dt><dd><bdi dir="ltr">{o.tracking_no}</bdi></dd></div>}
          </dl>
        )}
      </section>

      <section className="st-invoice" aria-labelledby="st-inv-h">
        <h2 id="st-inv-h">{t.invoice}</h2>
        <dl className="st-kv">
          {o.receipt_no != null && <div><dt>{t.invoiceNo}</dt><dd><bdi dir="ltr">{o.receipt_no}</bdi></dd></div>}
          <div><dt>{t.orderNo}</dt><dd><bdi dir="ltr">{no}</bdi></dd></div>
          <div><dt>{t.date}</dt><dd>{when(o.paid_at ?? o.created_at)}</dd></div>
          <div><dt>{t.seller}</dt><dd>{seller.trade}{seller.legal && <small>{seller.legal}</small>}</dd></div>
          {seller.vat && <div><dt>{t.vatNo}</dt><dd><bdi dir="ltr">{seller.vat}</bdi></dd></div>}
          {seller.cr && <div><dt>{t.crNo}</dt><dd><bdi dir="ltr">{seller.cr}</bdi></dd></div>}
          <div><dt>{t.billTo}</dt><dd>{o.name}</dd></div>
        </dl>
        <h3 className="st-sub-h">{t.items}</h3>
        <ul className="st-mini">
          {o.items.map((i, k) => (
            <li key={k}>
              <span className="st-mini-img">{i.image ? <img src={sized(i.image, 640)} alt="" loading="lazy" /> : <NoPhoto />}<i>{i.qty}</i></span>
              <span className="st-mini-mid">
                {i.slug ? <Link href={`/store/${i.slug}`}><b>{i.name}</b></Link> : <b>{i.name}</b>}
                <small>{[i.variant, t.qtyN(i.qty)].filter(Boolean).join(" · ")} · <Amt>{t.each(sar(i.unit_price))}</Amt></small>
              </span>
              <Amt>{sar(i.unit_price * i.qty)}</Amt>
            </li>
          ))}
        </ul>
        <p className="bk-sum-row"><span>{t.subtotal}</span><Amt>{sar(o.subtotal)}</Amt></p>
        <p className="bk-sum-row"><span>{way}</span>{o.delivery_fee === 0 ? <span>{t.free}</span> : <Amt>{sar(o.delivery_fee)}</Amt>}</p>
        <p className="bk-sum-tot sep"><span>{t.total}</span><Amt>{sar(o.total)}</Amt></p>
        <p className="st-vatline">{t.vatOf(sar(o.vat))}</p>
        {o.wallet_paid > 0 && <p className="bk-sum-row"><span>{t.paidWallet}</span><Amt>{sar(o.wallet_paid)}</Amt></p>}
        {card && cardPart > 0 && <p className="bk-sum-row"><span>{t.paidWith(card)}</span><Amt>{sar(cardPart)}</Amt></p>}
      </section>

      {o.events.length > 0 && (
        <section className="st-history" aria-labelledby="st-hist-h">
          <h2 id="st-hist-h">{t.history}</h2>
          <ol>
            {[...o.events].reverse().map((e, i) => (
              <li key={i}>
                <b>{statusWord(e.status)}</b>
                <time dateTime={e.at}>{when(e.at)}</time>
                {e.note && e.note !== "wallet" && <p>{e.note}</p>}
                {e.note === "wallet" && <p>{t.paidWallet}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="st-info st-ord-returns" aria-labelledby="st-ret-h">
        <h2 id="st-ret-h" className="st-info-h"><Ic name="back" size={18} />{t.returnsH}</h2>
        <p className="st-info-note">{t.returns}{returnsHref && <> <a href={returnsHref}>{t.returnsLink}</a></>}</p>
      </section>

      <div className="st-ord-acts">
        <PrintButton />
        {wa && reportable(o, now) && <a className="bk-btn2" href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppMark size={18} />{t.mistake}</a>}
      </div>

      {signup && (
        <section className="st-alert st-join">
          <p>{t.account}</p>
          <a className="bk-btn2" href={signup}><Ic name="user" size={18} />{t.createAccount}</a>
        </section>
      )}
    </div>
  );
}
