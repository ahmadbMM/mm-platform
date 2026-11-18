import type { Metadata } from "next";
import { cookies } from "next/headers";
import { pageMeta } from "@/lib/seo";
import PageShell, { navFrom } from "@/components/site/PageShell";
import OrderView from "@/components/store/OrderView";
import TrackForm from "@/components/store/TrackForm";
import { LearnOffer, OrderWayFacts } from "@/components/store/OrderPlus";
import { learnOpen } from "@/components/store/sx-b3-data";
import { T as SX } from "@/components/store/sx-B3.text";
import "@/components/store/sx-B3.css";
import { storeState } from "@/components/store/store-data";
import { T as STORE_T } from "@/components/store/Store.text";
import { T as W5 } from "@/components/store/w5.text";
import { rpcServer } from "@/lib/account";
import { ACCOUNT_COOKIE, decodeSession, type Session } from "@/lib/account-core";
import { bookingLink } from "@/lib/links";
import { payRpc } from "@/lib/pay/server";
import { invoiceSeller, slotWhen } from "@/lib/store-after";
import { fmtRange } from "@/lib/store-delivery";
import { orderExpected, orderOf, type Order } from "@/lib/store-order";
import { POLICY } from "@/lib/store-policy";
import { deliverySlots } from "@/lib/store-settings";
import { afterSettings, APP_META, handoverOf } from "@/lib/sx-B4";
import { afterRead } from "@/lib/sx-B4-api";
import { LEGAL_WARRANTY_MONTHS, warrantyMonths } from "@/lib/store-policy";
import { afterParts } from "@/components/store/after/AfterParts";
import { orderExtrasOf, sxSettings } from "@/lib/sx-b3";
import { serverLocalize } from "@/i18n/dicts";
import { intlOf } from "@/i18n/locales";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store/order/<number>?k=<key> - an order's confirmation, tracking and invoice
// (components/store/OrderView.tsx), read by this server with the order's own key (store_order_get). The
// payment page sends the customer here, and so do Track order and My Account. Without a key that matches,
// the page asks for the order number and the mobile it was placed with. It answers whether the store is
// open or not: an order placed before it closed must stay reachable. The gift cards it bought show their codes
// masked (the key is what Track order hands anyone with the number and the phone), whole only for their buyer: the
// account that placed the order (read here, customer_orders) or the browser that placed it (its gift key, GiftReveal).
type Props = { params: Promise<{ locale: string; no: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, no } = await params;
  const s = await storeState(locale);
  // Add to Home Screen is offered on an order's page (N05, builder B4): the page names the site's manifest
  return { ...pageMeta({ path: `/store/order/${no}`, locale, title: `${s.t.order(`MM-${no.replace(/\D/g, "")}`)} · Micromobility`, noindex: true }), ...APP_META };
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { locale, no } = await params;
  const k = (await searchParams).k;
  const key = typeof k === "string" && /^[0-9a-f]{32}$/i.test(k) ? k : null;
  const num = /^\d{1,9}$/.test(no) ? Number(no) : null;
  const s = await storeState(locale);
  // the order, and beside it what after the sale adds (builder B4: null from a database without store_after_read)
  const [r, extra] = key && num ? await Promise.all([payRpc<unknown>("store_order_get", { p_no: num, p_track: key }), afterRead(num, key)]) : [null, null];
  const read = r && r.status === 200 ? orderOf(r.data, key) : null;
  const acct = decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
  const o = read && acct && read.gift_cards.some((g) => g.masked) ? await withOwnCodes(read, acct) : read;
  // notifications for an order are offered to the account that placed it alone (N04, while staff have them on)
  const owner = !!(read && acct && afterSettings(s.content).push && extra) && (await ownOrder(read, acct));
  const { t, site } = s;
  const S = (v: unknown) => (typeof v === "string" ? v : "");

  if (!o) {
    return (
      <PageShell locale={locale} site={site} preview={s.previewing} hidden={s.hidden}>
        <div className="st st-narrow">
          <h1 className="st-title">{t.findTitle}</h1>
          <p className="st-lead">{t.trackLead}</p>
          <TrackForm start={num ? `MM-${num}` : ""} />
        </div>
      </PageShell>
    );
  }
  const now = new Date().getTime(); // the server draws the page once: the hold and the day to report a mistake are read from it
  const expected = orderExpected(o, s.settings);
  const guest = !acct;
  const app = navFrom(site).booking.replace(/[?#].*$/, "");
  // the seller as the invoice names it (L06): the one the order kept when its invoice was issued, else the store's one
  // legal identity of today (lib/store-after.ts invoiceSeller); the legal name in the page's language with the other one
  // beside it, the Arabic one in ZATCA's QR
  const seller = invoiceSeller(o, s.content, locale);
  const ar = locale === "ar";
  const intl = intlOf(locale);
  const booked = slotWhen(o, deliverySlots(s.content));
  // the hours as one left-to-right run (an Arabic line showed "21:00–16:00"; builder B4)
  const slot = booked ? [fmtRange({ from: booked.day, to: booked.day }, intl), booked.from && booked.to ? `\u2066${booked.from}–${booked.to}\u2069` : ""].filter(Boolean).join(", ") : null;
  const products = new Map(s.store.products.map((p) => [p.id, p]));
  const after = afterParts({
    o: { ...o, handover: handoverOf(r?.data) }, after: extra, content: s.content, locale, today: s.today, now, owner, workshop: !s.hidden.includes("workshop"), expected,
    bikes: new Set(s.store.products.filter((p) => p.category === "bikes").map((p) => p.id)),
    monthsOf: (id) => { const p = id ? products.get(id) : null; return p ? warrantyMonths(p) : LEGAL_WARRANTY_MONTHS.new; },
  });
  // the build of 2026-11-18 (B3): a company's standard tax invoice (N34), the handover slot, session and pin (N13, N15,
  // N07), and the lessons for a bike bought by someone still learning (N17), from the order's own JSON (absent on a
  // database without them)
  const ex = orderExtrasOf(r?.data);
  const sx = serverLocalize(SX, locale);
  const learn = ex.learning && sxSettings(s.content).learning && learnOpen(s, locale) && !["cancelled", "refunded", "pending"].includes(o.status);
  return (
    <PageShell locale={locale} site={site} preview={s.previewing} hidden={s.hidden}>
      <OrderView
        o={o} t={t} w={serverLocalize(W5, locale)} locale={locale} now={now} today={s.today}
        beside={ar ? { lang: "en", t: STORE_T.en, w: W5.en } : { lang: "ar", t: STORE_T.ar, w: W5.ar }}
        seller={{ trade: "Micromobility", ...seller, address: S(site.contact.address) }}
        whatsapp={S(site.contact.phone).replace(/\D/g, "")}
        showroom={S(site.contact.address)}
        expected={expected ? fmtRange(expected, intl) : null}
        slot={slot}
        signup={guest ? bookingLink(`${app}?handoff=site&auth=signup`, locale) : null}
        // the Returns page answers whatever the store and Help switches say (CONTRACTS.md section 7, w1)
        returnsHref="/returns"
        policy={serverLocalize(POLICY, locale).returnSentence}
        hidden={s.hidden}
        after={after}
        sx={{
          buyer: ex.buyer, x: sx, bx: ar ? SX.en : SX.ar,
          wayName: ex.session ? sx.atSession : undefined,
          way: <OrderWayFacts e={ex} x={sx} intl={intl} />,
          after: learn ? <LearnOffer x={sx} /> : null,
        }}
      />
    </PageShell>
  );
}

/** Whether the signed-in account placed this order (customer_orders answers the account's own orders). */
async function ownOrder(o: Order, acct: Session): Promise<boolean> {
  const r = await rpcServer<unknown>("customer_orders", { p_id: acct.id, p_token: acct.token });
  return r.status === 200 && Array.isArray(r.data) && r.data.some((x) => orderOf(x)?.id === o.id);
}

/** The order with its gift cards' whole codes when the signed-in account placed it (customer_orders answers its own orders'
 *  codes whole; CONTRACTS.md Additions by lead: gift card codes); as it was read otherwise. */
async function withOwnCodes(o: Order, acct: Session): Promise<Order> {
  const r = await rpcServer<unknown>("customer_orders", { p_id: acct.id, p_token: acct.token });
  const mine = r.status === 200 && Array.isArray(r.data) ? r.data.map((x) => orderOf(x)).find((x) => !!x && x.id === o.id) : null;
  return mine ? { ...o, gift_cards: mine.gift_cards } : o;
}
