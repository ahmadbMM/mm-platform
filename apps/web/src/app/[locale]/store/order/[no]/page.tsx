import type { Metadata } from "next";
import { cookies } from "next/headers";
import { pageMeta } from "@/lib/seo";
import PageShell, { navFrom } from "@/components/site/PageShell";
import OrderView from "@/components/store/OrderView";
import TrackForm from "@/components/store/TrackForm";
import { storeState } from "@/components/store/store-data";
import { ACCOUNT_COOKIE, decodeSession } from "@/lib/account-core";
import { bizOf } from "@/lib/biz";
import { bookingLink } from "@/lib/links";
import { payRpc } from "@/lib/pay/server";
import { fmtRange } from "@/lib/store-delivery";
import { orderExpected, orderOf } from "@/lib/store-order";
import { intlOf } from "@/i18n/locales";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store/order/<number>?k=<key> - an order's confirmation, tracking and invoice
// (components/store/OrderView.tsx), read by this server with the order's own key (store_order_get). The
// payment page sends the customer here, and so do Track order and My Account. Without a key that matches,
// the page asks for the order number and the mobile it was placed with. It answers whether the store is
// open or not: an order placed before it closed must stay reachable.
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
  const o = r && r.status === 200 ? orderOf(r.data, key) : null;
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
  const guest = !decodeSession((await cookies()).get(ACCOUNT_COOKIE)?.value);
  const app = navFrom(site).booking.replace(/[?#].*$/, "");
  return (
    <PageShell locale={locale} site={site} preview={s.previewing} hidden={s.hidden}>
      <OrderView
        o={o} t={t} locale={locale} now={now}
        seller={{ trade: "Micromobility", legal: S(site.legal.legalName), vat: bizOf(s.content).vatNo ?? S(site.legal.vat), cr: S(site.legal.cr) }}
        whatsapp={S(site.contact.phone).replace(/\D/g, "")}
        showroom={S(site.contact.address)}
        expected={expected ? fmtRange(expected, intlOf(locale)) : null}
        signup={guest ? bookingLink(`${app}?handoff=site&auth=signup`, locale) : null}
        returnsHref={s.hidden.includes("help") ? null : "/help#returns"}
      />
    </PageShell>
  );
}
