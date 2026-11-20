import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MkFrame, { marketSite } from "@/components/market/MkFrame";
import MkGate from "@/components/market/MkGate";
import SellApp from "@/components/market/w2/SellApp";
import { T } from "@/components/market/w2.text";
import "@/components/market/w2.css";
import { serverLocalize } from "@/i18n/dicts";
import { listingIdOf, sellHref } from "@/lib/market/core";
import { mkSession } from "@/lib/market/server";
import { sellData } from "@/lib/market/w2-server";
import { pageMeta } from "@/lib/seo";

// micromobility.sa/marketplace/sell/<id>: a seller carries on with one of their own drafts, or edits one of their own
// listings (on sale, reserved or expired), in the same form as a new one. A number that is not one of the account's
// listings, or a listing that cannot be edited now (sold, being checked by our team, removed), says so and leads to
// My listings. The account's own page: never in search engines, never kept at the edge.
export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params;
  const m = serverLocalize(T, locale);
  const n = listingIdOf(id);
  return pageMeta({ path: n ? sellHref(n) : "/marketplace/sell", locale, noindex: true, title: `${m.editTitle} · MicroMobility` });
}

export default async function SellEditPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const listingId = listingIdOf(id);
  if (listingId === null) notFound();
  const [at, session] = await Promise.all([marketSite(locale), mkSession()]);
  const data = session ? await sellData(session) : null;
  return (
    <MkFrame locale={locale} at={at} narrow>
      <MkGate locale={locale} session={session}>
        <div className="mk-w2-wrap">{data && <SellApp locale={locale} listingId={listingId} {...data} />}</div>
      </MkGate>
    </MkFrame>
  );
}
