import type { Metadata } from "next";
import { cookies } from "next/headers";
import { pageMeta } from "@/lib/seo";
import PageShell, { navFrom } from "@/components/site/PageShell";
import OrderView from "@/components/store/OrderView";
import TrackForm from "@/components/store/TrackForm";
import { storeState } from "@/components/store/store-data";
import { T as STORE_T } from "@/components/store/Store.text";
import { T as W5 } from "@/components/store/w5.text";
import { rpcServer } from "@/lib/account";
import { ACCOUNT_COOKIE, decodeSession, type Session } from "@/lib/account-core";
import { bookingLink } from "@/lib/links";
import { payRpc } from "@/lib/pay/server";
import { slotWhen } from "@/lib/store-after";
import { fmtRange } from "@/lib/store-delivery";
import { orderExpected, orderOf, type Order } from "@/lib/store-order";
import { POLICY } from "@/lib/store-policy";
import { deliverySlots, storeLegal } from "@/lib/store-settings";
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
  return pageMeta({ path: `/store/order/${no}`, locale, title: `${s.t.order(`MM-${no.replace(/\D/g, "")}`)} · Micromobility`, noindex: true });
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { locale, no } = await params;
  const k = (await searchParams).k;
  const key = typeof k === "string" && /^[0-9a-f]{32}$/i.test(k) ? k : null;
  const num = /^\d{1,9}$/.test(no) ? Number(no) : null;
  const s = await storeState(locale);
  const r = key && num ? await payRpc<unknown>("store_order_get", { p_no: num, p_track: key }) : null;
  const read = r && r.status === 200 ? orderOf(r.data, key) : null;
  const acct = decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
  const o = read && acct && read.gift_cards.some((g) => g.masked) ? await withOwnCodes(read, acct) : read;
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
  // the seller as the invoice names it (L06): the store's one legal identity (lib/store-settings.ts storeLegal), the
  // legal name in the page's language with the other one beside it, the Arabic one in ZATCA's QR
  const legal = storeLegal(s.content, locale);
  const ar = locale === "ar";
  const other = storeLegal(s.content, ar ? "en" : "ar");
  const intl = intlOf(locale);
  const booked = slotWhen(o, deliverySlots(s.content));
  const slot = booked ? [fmtRange({ from: booked.day, to: booked.day }, intl), booked.from && booked.to ? `${booked.from}–${booked.to}` : ""].filter(Boolean).join(", ") : null;
  return (
    <PageShell locale={locale} site={site} preview={s.previewing} hidden={s.hidden}>
      <OrderView
        o={o} t={t} w={serverLocalize(W5, locale)} locale={locale} now={now} today={s.today}
        beside={ar ? { lang: "en", t: STORE_T.en, w: W5.en } : { lang: "ar", t: STORE_T.ar, w: W5.ar }}
        seller={{
          trade: "Micromobility", legal: legal.legalName, legalBeside: other.legalName, vat: legal.vat, cr: legal.cr,
          address: S(site.contact.address), qrName: storeLegal(s.content, "ar").legalName,
        }}
        whatsapp={S(site.contact.phone).replace(/\D/g, "")}
        showroom={S(site.contact.address)}
        expected={expected ? fmtRange(expected, intl) : null}
        slot={slot}
        signup={guest ? bookingLink(`${app}?handoff=site&auth=signup`, locale) : null}
        // the Returns page answers whatever the store and Help switches say (CONTRACTS.md section 7, w1)
        returnsHref="/returns"
        policy={serverLocalize(POLICY, locale).returnSentence}
        hidden={s.hidden}
      />
    </PageShell>
  );
}

/** The order with its gift cards' whole codes when the signed-in account placed it (customer_orders answers its own orders'
 *  codes whole; CONTRACTS.md Additions by lead: gift card codes); as it was read otherwise. */
async function withOwnCodes(o: Order, acct: Session): Promise<Order> {
  const r = await rpcServer<unknown>("customer_orders", { p_id: acct.id, p_token: acct.token });
  const mine = r.status === 200 && Array.isArray(r.data) ? r.data.map((x) => orderOf(x)).find((x) => !!x && x.id === o.id) : null;
  return mine ? { ...o, gift_cards: mine.gift_cards } : o;
}
