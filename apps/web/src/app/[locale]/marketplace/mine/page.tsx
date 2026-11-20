import type { Metadata } from "next";
import MkFrame, { marketSite } from "@/components/market/MkFrame";
import MkGate from "@/components/market/MkGate";
import SellLink from "@/components/market/SellLink";
import { T as M } from "@/components/market/Market.text";
import MyListings from "@/components/market/w2/MyListings";
import "@/components/market/w2.css";
import { serverLocalize } from "@/i18n/dicts";
import { MK_MINE, mkSettings } from "@/lib/market/core";
import { mkMyListings, mkSession } from "@/lib/market/server";
import { drawnAt } from "@/lib/market/w2-server";
import { pageMeta } from "@/lib/seo";

// micromobility.sa/marketplace/mine: the signed-in account's own listings, each with its state and what can be done
// with it now (components/market/w2/MyListings.tsx), and the way to sell another. The listings are read on the server
// for the account in the cookie and handed to the page's script, which reads them again through the site's own route
// after a change. Signed out, the site's sign-in. Never in search engines, never kept at the edge.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = serverLocalize(M, locale);
  return pageMeta({ path: MK_MINE, locale, noindex: true, title: `${t.myListings} · MicroMobility` });
}

export default async function MinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = serverLocalize(M, locale);
  const [at, session] = await Promise.all([marketSite(locale), mkSession()]);
  const r = session ? await mkMyListings(session) : null;
  return (
    <MkFrame locale={locale} at={at}>
      <MkGate locale={locale} session={session}>
        <div className="mk-w2-wrap mk-w2-mine">
          <div className="mk-w2-mine-head">
            <h1>{t.myListings}</h1>
            <SellLink t={t} />
          </div>
          {r && <MyListings locale={locale} items={r.ok ? r.data.items : null} error={r.ok ? null : { error: r.error, detail: r.detail }} how={mkSettings(at.content).commissionHow} now={drawnAt()} />}
        </div>
      </MkGate>
    </MkFrame>
  );
}
