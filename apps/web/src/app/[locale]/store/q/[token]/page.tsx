import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import { openOr404, storeState } from "@/components/store/store-data";
import { CheckoutView } from "@/components/store/sx-b3-checkout";
import { T as X } from "@/components/store/sx-B3.text";
import { Link } from "@/i18n/navigation";
import { getAccount } from "@/lib/account";
import { payRpc } from "@/lib/pay/server";
import { dateLabel } from "@/lib/store-checkout";
import { quoteNo, quoteOf, quoteTokenOk } from "@/lib/sx-b3";
import { serverLocalize } from "@/i18n/dicts";
import { intlOf } from "@/i18n/locales";
import "@/components/experiences/experiences.css";
import "@/components/account/account.css";
import "@/components/store/store.css";
import "@/components/store/sx-B3.css";

// micromobility.sa/store/q/<token> - a quote staff built in the staff Store screen and sent on WhatsApp (N23, the build
// of 2026-11-18): the bike, its size and colour, the extras, the way it is had and its slot, read with the server key
// (store_quote_get), open as a filled-in checkout with the all-in total, paid on the same payment page as any order.
// Nothing is held while it is only a link: the stock is held once the order is placed (F86), as for any order. A quote
// past its date, used for an order that was paid, or withdrawn by staff says so, with a WhatsApp link to ask for a new
// one. Never kept at the edge (lib/page-cache.ts) and never indexed.
type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, token } = await params;
  return pageMeta({ path: `/store/q/${token}`, locale, title: `${serverLocalize(X, locale).quote} · Micromobility`, noindex: true });
}

export default async function QuotePage({ params }: Props) {
  const { locale, token } = await params;
  if (!quoteTokenOk(token)) notFound();
  const [s, acct] = await Promise.all([storeState(locale), getAccount()]);
  openOr404(s);
  const r = await payRpc<unknown>("store_quote_get", { p_token: token });
  const q = r.status === 200 ? quoteOf(r.data) : null;
  if (!q) notFound();
  const x = serverLocalize(X, locale);
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  const wa = S(s.site.contact.phone).replace(/\D/g, "");
  const until = q.expires ? dateLabel(q.expires, intlOf(locale)) : "";
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      {q.state === "open" && q.items.length > 0 ? (
        <div className="st">
          <h1 className="st-title sx3-qh">{x.quote}</h1>
          <p className="sx3-qfacts"><bdi dir="ltr">{quoteNo(q.no)}</bdi>{until && <span>{x.validUntil(until)}</span>}</p>
          <CheckoutView s={s} locale={locale} acct={acct} buy={q.items}
            quote={{ token, no: q.no, fulfil: q.fulfil, slot: q.slot, handover: q.handover, name: q.name, phone: q.phone }} />
        </div>
      ) : (
        <div className="st st-narrow">
          <h1 className="st-title">{x.quote}</h1>
          <div className="st-empty">
            <p>{q.state === "used" ? x.quoteUsed(q.orderNo ? `MM-${q.orderNo}` : quoteNo(q.no)) : q.state === "expired" ? x.quoteExpired : x.quoteVoid}</p>
            {q.state !== "used" && wa && (
              <a className="bk-btn" href={`https://wa.me/${wa}?text=${encodeURIComponent(x.askNewMsg(quoteNo(q.no)))}`} target="_blank" rel="noopener">{x.askNew}</a>
            )}
            <Link href="/store" className={q.state !== "used" && wa ? "st-link" : "bk-btn"}>{s.t.browse}</Link>
          </div>
        </div>
      )}
    </PageShell>
  );
}
