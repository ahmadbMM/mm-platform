import { Fragment, type ReactNode } from "react";
import type { Buyer } from "@/lib/sx-b3";
import type { SxText } from "./sx-B3.text";
import { dayLabel } from "@/lib/store-checkout";
import { T as SPM, type SpmText } from "./spm.text";
import { PreorderLine } from "./spm-parts";
import { putBackItems } from "@/lib/store-rules";
import { Link } from "@/i18n/navigation";
import { intlOf } from "@/i18n/locales";
import { sized } from "@/lib/img";
import { sar } from "@/lib/store-core";
import {
  discountRows, eventKey, eventNote, giftState, invoiceIssued, invoiceNumber, invoiceQr, lineHref, outToday, paidParts, refundRows,
  returnableLines, returnLines, reviewItems, serviceShown, statusKey,
} from "@/lib/store-after";
import { orderNo, orderSteps, paidWith, payable, reportable, unpaidCancel, type Order } from "@/lib/store-order";
import { returnWindow } from "@/lib/store-policy";
import type { StoreText } from "./Store.text";
import type { W5Text } from "./w5.text";
import { Amt, Ic, NoPhoto, WhatsAppMark } from "./bits";
import { StIcon } from "./icons";
import InvoiceQr from "./InvoiceQr";
import { CopyNo, PrintButton, PutBack } from "./OrderActions";
import { GiftActs, GiftCode, GiftReveal, ReturnStart, ReviewAsk } from "./OrderAfter";
import type { AfterNodes } from "./after/AfterParts";

// An order's page: confirmation, tracking and the invoice in one, to keep or print. The number to copy, where
// the order is (paid, preparing, ready or on its way, out for delivery today, then collected or delivered), when it is
// expected or the day booked, the courier's tracking number once it is sent, the gift cards it bought with their codes
// to print (whole for their buyer alone, else masked: GiftReveal), a review asked of each product once it is delivered,
// the simplified tax invoice (every line and amount with the VAT, the seller's name, address, VAT and CR numbers, its own
// number and ZATCA's QR, the labels in Arabic beside the page's language) with every refund under it, what happened to
// it, the return terms with a return or exchange to ask for, and the workshop. An unpaid order offers its payment while
// the items are held; one that was never paid can put its items back in the cart.
//   The product-management build (2026-11-19): a pre-order line says so, with the day its product ships by while the
// order is still to be got ready (`x`: those words in the page's language).
export type Seller = {
  trade: string; legal: string; vat: string; cr: string; address: string;
  /** The legal name the QR carries (the Arabic one, as registered), and the one beside the page's. */
  qrName: string; legalBeside: string;
};
/** The invoice's labels in the other of English and Arabic, shown beside the page's own once the invoice is issued
 *  (ZATCA: a tax invoice is in Arabic; the page's language reads it). */
export type Beside = { lang: "ar" | "en"; t: StoreText; w: W5Text };

/** The booked delivery day (F78) is said while the order is still to come: not once it is delivered, cancelled or
 *  refunded (the expected dates' own rule, lib/store-order.ts orderExpected, with an order still to pay). */
const SLOT_SHOWN: readonly string[] = ["pending", "paid", "preparing", "shipped", "out"];
/** A pre-order line's ships-by day is said while the order is still to be got ready; after that the line says only that
 *  it was a pre-order. */
const PRE_DATED: readonly string[] = ["pending", "paid", "preparing"];
/** A code typed in Latin letters, digits and dashes ("WELCOME-10") as one left-to-right run inside the page's words, so
 *  an Arabic line never shows it as "10-WELCOME" (the same isolates sar() puts round an amount). */
const ltr = (s: string) => `\u2066${s}\u2069`;

export default function OrderView({ o, t, w, beside, locale, seller, now, today, whatsapp, showroom, expected, slot, signup, returnsHref, policy, hidden, after = null, sx, x = SPM.en, notSold }: {
  o: Order; t: StoreText; w: W5Text; beside: Beside; locale: string; seller: Seller; now: number; today: string; whatsapp: string; showroom: string;
  expected: string | null; slot: string | null; signup: string | null; returnsHref: string; policy: string; hidden: readonly string[];
  /** After the sale (builder B4, components/store/after/AfterParts.tsx): its parts in their places, and Hijri dates. */
  after?: AfterNodes | null;
  /** The build of 2026-11-18 (B3): a company's standard tax invoice (N34: the buyer, with the words in both languages),
   *  the way's own facts (the handover slot, the session, the pin) and what follows it (learning to ride). */
  sx?: { buyer: Buyer | null; x: SxText; bx: SxText; way?: ReactNode; after?: ReactNode; wayName?: string };
  x?: SpmText;
  /** The variants (lower case) of products the store does not sell (a Preview): never put back in the cart. */
  notSold?: ReadonlySet<string>;
}) {
  const hj = after?.hijri;
  const no = orderNo(o.no);
  const intl = intlOf(locale);
  const when = (iso: string | null) => {
    if (!iso || !Number.isFinite(Date.parse(iso))) return "";
    return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Riyadh" }).format(new Date(iso));
  };
  const day = (iso: string | null) => {
    if (!iso || !Number.isFinite(Date.parse(iso))) return "";
    return new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(iso));
  };
  const words: Record<string, string> = { ...t.status, ...w.events, out: w.statusOut, outToday: w.statusOutToday, giftReady: w.giftReady };
  const word = (key: string) => words[key] ?? key;
  const { steps, at } = orderSteps(o);
  const card = paidWith(o.payment);
  const parts = paidParts(o);
  const way = sx?.wayName ? sx.wayName : o.fulfil === "pickup" ? t.pickup : o.fulfil === "jeddah" ? t.jeddah : o.fulfil === "ksa" ? t.ksa : w.wayDigital;
  const wa = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(t.mistakeMsg(no))}` : null;
  const outNow = outToday(o, today);

  // the simplified tax invoice (L06): issued once paid, with its own number and ZATCA's QR
  const issued = invoiceIssued(o);
  const invNo = issued ? invoiceNumber(o) : null;
  const qr = invoiceQr(o, { name: seller.qrName, vat: seller.vat });
  const buyer = sx?.buyer ?? null;
  const dir = beside.lang === "ar" ? "rtl" : "ltr";
  const bw = beside.w, bt = beside.t;
  // a label in the page's language, and once the invoice is issued the other one beside it
  // (the outer span keeps the page's direction, so its gap falls between the two; the inner one reads in its own)
  const other = (b: string) => <span lang={beside.lang} dir={dir}>{b}</span>;
  const lab = (a: string, b: string) => (issued && b && b !== a ? <>{a}<span className="st-zb">{other(b)}</span></> : a);
  const bWay = o.fulfil === "pickup" ? bt.pickup : o.fulfil === "jeddah" ? bt.jeddah : o.fulfil === "ksa" ? bt.ksa : bw.wayDigital;
  const refunds = refundRows(o);
  const sent = ["shipped", "out", "delivered"].includes(o.status) && o.fulfil !== "digital";

  // after it is delivered: what can still be returned (F93) and reviewed (F94)
  const win = returnWindow(o, now);
  const lines = returnableLines(o);
  const toReview = o.key ? reviewItems(o) : [];
  // what Put back adds: never a product the store does not sell (a Preview)
  const back = putBackItems(o.items, notSold);

  return (
    <div className="st st-order">
      <header className="st-ord-head">
        <p className="st-eyebrow">{t.orderNo}</p>
        <div className="st-ord-no"><h1><bdi dir="ltr">{no}</bdi></h1><CopyNo text={no} /></div>
        <p className={`st-badge s-${o.status}`}>{word(statusKey(o, o.status, today))}</p>
        {["paid", "preparing", "ready", "shipped", "out", "delivered"].includes(o.status) && <p className="st-thanks">{t.thanks}</p>}
        {after?.head}
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
          {/* its hold ran out and the order is not yet let go: the items can go back into the cart already (the payment
              page's Start again comes here; bug hunt 2026-11-11) */}
          {!payable(o, now) && o.payment && o.payment.status !== "paid" && back.length > 0 && <PutBack items={back} />}
        </section>
      )}
      {o.status === "cancelled" && (
        <section className="st-alert warn">
          <h2>{t.cancelledMsg}</h2>
          {unpaidCancel(o) && <p>{t.unpaid}</p>}
          {unpaidCancel(o) && back.length > 0 && <PutBack items={back} />}
        </section>
      )}
      {o.status === "refunded" && <section className="st-alert warn"><h2>{t.refundedMsg}</h2></section>}

      {at !== null && at >= 0 && (
        <ol className={`st-steps n${steps.length}`} aria-label={t.progress}>
          {steps.map((st, i) => (
            <li key={st} className={i <= at ? "done" : undefined} aria-current={i === at ? "step" : undefined}>
              <span className="st-step-dot">{i <= at && <Ic name="tick" size={14} />}</span>
              <span>{word(statusKey(o, st, today))}</span>
            </li>
          ))}
        </ol>
      )}

      <section className="st-ord-way" aria-label={way}>
        <p>{o.fulfil === "digital" ? <StIcon name="gift" size={20} /> : <Ic name={o.fulfil === "pickup" ? "shop" : "truck"} size={20} />}<b>{way}</b></p>
        {o.fulfil === "pickup" ? !sx?.wayName && <p>{t.collectFrom(showroom)}</p>
          : o.fulfil !== "digital" && o.address && <p>{t.deliverTo}: {[o.address.district, o.address.city].filter(Boolean).join(", ")}</p>}
        {!outNow && (slot && SLOT_SHOWN.includes(o.status) ? <p className="st-expected">{w.slotOn(slot)}{hj?.slot && <span className="sxb-hijri">{hj.slot}</span>}</p>
          : expected && <p className="st-expected">{t.expected(expected)}{hj?.expected && <span className="sxb-hijri">{hj.expected}</span>}</p>)}
        {(o.courier || o.tracking_no) && (
          <dl className="st-kv">
            {o.courier && <div><dt>{t.courier}</dt><dd>{o.courier}</dd></div>}
            {o.tracking_no && <div><dt>{t.tracking}</dt><dd><bdi dir="ltr">{o.tracking_no}</bdi></dd></div>}
          </dl>
        )}
        {after?.way}
        {sx?.way}
      </section>
      {after?.build}
      {sx?.after}

      {o.gift_cards.length > 0 && (
        <GiftReveal no={o.no} k={o.key} cards={o.gift_cards}>
          <section className="st-ogcs" aria-labelledby="st-ogcs-h">
            <h2 id="st-ogcs-h">{w.giftCardsH}</h2>
            <ul>
              {o.gift_cards.map((g, i) => {
                const st = giftState(g, now);
                const id = `st-ogc-${i + 1}`;
                return (
                  <li key={id} id={id} className={`st-ogc g-${st}`}>
                    <div className="st-ogc-card">
                      <p className="st-ogc-brand"><span>{seller.trade}</span><StIcon name="gift" size={22} /></p>
                      <p className="st-ogc-name">{w.giftCard}</p>
                      <p className="st-ogc-amt"><Amt>{sar(g.amount)}</Amt></p>
                      <p className="st-ogc-code"><GiftCode i={i} code={g.code} /></p>
                      {g.expires_at && st !== "void" && <p className="st-ogc-exp">{w.giftValid(day(g.expires_at))}</p>}
                      <p className="st-ogc-site" dir="ltr">micromobility.sa/store</p>
                    </div>
                    <div className="st-ogc-meta">
                      {st !== "active" && <p className={`st-pill g-${st}`}>{w.giftState[st]}</p>}
                      {st === "active" && g.balance < g.amount && <p className="st-ogc-bal"><Amt>{t.balance(sar(g.balance))}</Amt></p>}
                      {st === "active" && <GiftActs i={i} target={id} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </GiftReveal>
      )}

      {o.key && toReview.length > 0 && <ReviewAsk no={o.no} k={o.key} lang={locale} items={toReview} />}

      <section className={`st-invoice${issued ? " st-zinv" : ""}`} aria-labelledby="st-inv-h">
        <div className="st-inv-top">
          <div>
            {/* a company's order is a standard tax invoice with the buyer's VAT number, name and address (N34) */}
            <h2 id="st-inv-h">{issued ? (buyer && sx ? sx.x.taxInvoice : w.taxInvoice) : t.summary}</h2>
            {issued && <p className="st-zb-h">{other(buyer && sx ? sx.bx.taxInvoice : bw.taxInvoice)}</p>}
          </div>
          {qr && <InvoiceQr text={qr} label={w.qrLabel} />}
        </div>
        <dl className="st-kv">
          {invNo && <div><dt>{lab(t.invoiceNo, bt.invoiceNo)}</dt><dd><bdi dir="ltr">{invNo}</bdi></dd></div>}
          <div><dt>{lab(t.orderNo, bt.orderNo)}</dt><dd><bdi dir="ltr">{no}</bdi></dd></div>
          <div><dt>{lab(issued ? w.issued : t.date, bw.issued)}</dt><dd>{when(o.paid_at ?? o.created_at)}{hj?.issued && <small className="sxb-hijri">{hj.issued}</small>}</dd></div>
          <div>
            <dt>{lab(t.seller, bt.seller)}</dt>
            <dd>{seller.trade}{seller.legal && <small>{seller.legal}</small>}
              {issued && seller.legalBeside && seller.legalBeside !== seller.legal && <small>{other(seller.legalBeside)}</small>}</dd>
          </div>
          {issued && seller.address && <div><dt>{lab(t.address, bt.address)}</dt><dd>{seller.address}</dd></div>}
          {seller.vat && <div><dt>{lab(t.vatNo, bt.vatNo)}</dt><dd><bdi dir="ltr">{seller.vat}</bdi></dd></div>}
          {seller.cr && <div><dt>{lab(t.crNo, bt.crNo)}</dt><dd><bdi dir="ltr">{seller.cr}</bdi></dd></div>}
          <div><dt>{lab(t.billTo, bt.billTo)}</dt><dd>{buyer ? <>{buyer.name}<small>{o.name}</small></> : o.name}</dd></div>
          {buyer && sx && <div><dt>{lab(sx.x.buyerVat, sx.bx.buyerVat)}</dt><dd><bdi dir="ltr">{buyer.vat}</bdi></dd></div>}
          {buyer?.cr && sx && <div><dt>{lab(sx.x.buyerCr, sx.bx.buyerCr)}</dt><dd><bdi dir="ltr">{buyer.cr}</bdi></dd></div>}
          {buyer?.address && sx && <div><dt>{lab(sx.x.buyerAddress, sx.bx.buyerAddress)}</dt><dd>{buyer.address}</dd></div>}
          {issued && sent && (
            <div>
              <dt>{lab(w.supplied, bw.supplied)}</dt>
              <dd>{way}{o.address && (o.address.district || o.address.city) && <small>{[o.address.district, o.address.city].filter(Boolean).join(", ")}</small>}
                {o.delivered_at && <small>{day(o.delivered_at)}{hj?.supplied && <span className="sxb-hijri">{hj.supplied}</span>}</small>}</dd>
            </div>
          )}
        </dl>
        <h3 className="st-sub-h">{lab(t.items, bt.items)}</h3>
        <ul className="st-mini">
          {o.items.map((i, k) => {
            const href = lineHref(i);
            return (
              <li key={k}>
                <span className="st-mini-img">{i.image ? <img src={sized(i.image, 640)} alt="" loading="lazy" /> : <NoPhoto />}<i>{i.qty}</i></span>
                <span className="st-mini-mid">
                  {href ? <Link href={href}><b>{i.name}</b></Link> : <b>{i.name}</b>}
                  <small>{[i.variant, t.qtyN(i.qty)].filter(Boolean).join(" · ")} · <Amt>{t.each(sar(i.unit_price))}</Amt></small>
                  {i.preorder && <PreorderLine ships={PRE_DATED.includes(o.status) && i.ships_on ? dayLabel(i.ships_on, intl) : null} x={x} className="st-line-pre" />}
                </span>
                <Amt>{sar(i.unit_price * i.qty)}</Amt>
              </li>
            );
          })}
        </ul>
        <p className="bk-sum-row"><span>{lab(t.subtotal, bt.subtotal)}</span><Amt>{sar(o.subtotal)}</Amt></p>
        {discountRows(o).map((d, k) => (
          <p key={k} className="bk-sum-row st-disc">
            <span>{d.kind === "bundle" ? lab(w.discBundle, bw.discBundle) : d.kind === "promo" ? lab(w.discCode(ltr(d.ref)), bw.discCode(ltr(d.ref))) : lab(w.discount, bw.discount)}</span>
            <Amt>{`−${sar(d.amount)}`}</Amt>
          </p>
        ))}
        {o.fulfil !== "digital" && <p className="bk-sum-row"><span>{lab(way, bWay)}</span>{o.delivery_fee === 0 ? <span>{t.free}</span> : <Amt>{sar(o.delivery_fee)}</Amt>}</p>}
        <p className="bk-sum-tot sep"><span>{lab(issued ? w.totalVat : t.total, bw.totalVat)}</span><Amt>{sar(o.total)}</Amt></p>
        {issued ? <p className="bk-sum-row st-vatrow"><span>{lab(w.vatRow, bw.vatRow)}</span><Amt>{sar(o.vat)}</Amt></p> : <p className="st-vatline">{t.vatOf(sar(o.vat))}</p>}
        {parts.gift > 0 && <p className="bk-sum-row"><span>{lab(w.paidGift, bw.paidGift)}</span><Amt>{sar(parts.gift)}</Amt></p>}
        {parts.wallet > 0 && <p className="bk-sum-row"><span>{lab(t.paidWallet, bt.paidWallet)}</span><Amt>{sar(parts.wallet)}</Amt></p>}
        {card && parts.card > 0 && <p className="bk-sum-row"><span>{lab(t.paidWith(card), bt.paidWith(card))}</span><Amt>{sar(parts.card)}</Amt></p>}

        {refunds.length > 0 && (
          <div className="st-refunds">
            <h3 className="st-sub-h">{lab(w.refundsH, bw.refundsH)}</h3>
            <ul>
              {refunds.map((r, k) => (
                <li key={k}>
                  <span>
                    <b>{w.refundTo[r.dest]}</b>
                    <small>{[day(r.at), w.refundState[r.state]].filter(Boolean).join(" · ")}</small>
                  </span>
                  <Amt>{sar(r.amount)}</Amt>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {o.events.length > 0 && (
        <section className="st-history" aria-labelledby="st-hist-h">
          <h2 id="st-hist-h">{t.history}</h2>
          <ol>
            {[...o.events].reverse().map((e, i) => {
              const n = eventNote(e);
              return (
                <li key={i}>
                  <b>{word(eventKey(o, e))}</b>
                  <time dateTime={e.at}>{when(e.at)}</time>
                  {n?.kind === "text" && <p>{n.text}</p>}
                  {n?.kind === "wallet" && <p>{t.paidWallet}</p>}
                  {n?.kind === "refund" && <p><Amt>{sar(n.amount)}</Amt> · {w.refundTo[n.dest]}</p>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="st-info st-ord-returns" aria-labelledby="st-ret-h">
        <h2 id="st-ret-h" className="st-info-h"><Ic name="back" size={18} />{t.returnsH}</h2>
        {o.returns.length > 0 && (
          <ul className="st-rets">
            {o.returns.map((r) => (
              <li key={r.id}>
                <span>
                  <b>{r.kind === "exchange" ? w.reqExchange(day(r.created_at)) : w.reqReturn(day(r.created_at))}</b>
                  {/* each line in its own isolate: a Latin model name with "× 1" keeps its order inside an Arabic line */}
                  <small>{returnLines(o, r).map((l, k) => <Fragment key={k}><bdi>{l}</bdi>{" · "}</Fragment>)}{w.reasons[r.reason]}</small>
                </span>
                <span className={`st-pill r-${r.status}`}>{w.reqState[r.status]}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="st-info-note">{policy} <Link href={returnsHref}>{t.returnsLink}</Link></p>
        {o.key && (win.ret || win.exchange) && <div className="st-ret-go"><ReturnStart no={o.no} k={o.key} lines={lines} ret={win.ret} exchange={win.exchange} /></div>}
      </section>
      {after?.claim}

      <div className="st-ord-acts">
        <PrintButton />
        {serviceShown(o, hidden) && !after?.noService && <Link className="bk-btn2" href="/workshop"><StIcon name="spanner" size={18} />{w.bookService}</Link>}
        {wa && reportable(o, now) && <a className="bk-btn2" href={wa} target="_blank" rel="noopener noreferrer"><WhatsAppMark size={18} />{t.mistake}</a>}
        {after?.acts}
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
