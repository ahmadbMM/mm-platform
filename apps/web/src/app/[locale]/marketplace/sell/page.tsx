import type { Metadata } from "next";
import MkFrame, { marketSite } from "@/components/market/MkFrame";
import MkGate from "@/components/market/MkGate";
import { T as M } from "@/components/market/Market.text";
import SellApp from "@/components/market/w2/SellApp";
import "@/components/market/w2.css";
import { serverLocalize } from "@/i18n/dicts";
import { MK_SELL } from "@/lib/market/core";
import { mkSession } from "@/lib/market/server";
import { sellData } from "@/lib/market/w2-server";
import { pageMeta } from "@/lib/seo";

// micromobility.sa/marketplace/sell: a signed-in account lists an item for sale. The photos come first, then the
// sport and product type, the facts the category asks for, the condition, the title and description, the price and
// city, the checks a bike or an e-bike needs, how the seller is named, and one review screen with Publish
// (components/market/w2/SellForm.tsx). An account with drafts is offered them first. Signed out, the site's sign-in.
// It is the account's own page: never in search engines, never kept at the edge (lib/page-cache.ts).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = serverLocalize(M, locale);
  return pageMeta({ path: MK_SELL, locale, noindex: true, title: `${t.sell} · MicroMobility` });
}

export default async function SellPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const [at, session] = await Promise.all([marketSite(locale), mkSession()]);
  const data = session ? await sellData(session) : null;
  return (
    <MkFrame locale={locale} at={at} narrow>
      <MkGate locale={locale} session={session}>
        <div className="mk-w2-wrap">{data && <SellApp locale={locale} listingId={null} {...data} />}</div>
      </MkGate>
    </MkFrame>
  );
}
