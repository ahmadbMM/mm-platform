import type { Metadata } from "next";
import MkFrame, { marketSite } from "@/components/market/MkFrame";
import MkGate from "@/components/market/MkGate";
import MkIcon from "@/components/market/MkIcon";
import { T } from "@/components/market/Market.text";
import Inbox from "@/components/market/w3/Inbox";
import "@/components/market/w3.css";
import { serverLocalize } from "@/i18n/dicts";
import { Link } from "@/i18n/navigation";
import { MK_HOME, MK_INBOX, mkHasId } from "@/lib/market/core";
import { mkSession, mkThreads } from "@/lib/market/server";
import { inboxFmt } from "@/lib/market/w3-fmt";
import { pageMeta } from "@/lib/seo";

// micromobility.sa/marketplace/inbox: the signed-in account's Marketplace conversations, as a buyer and as a seller
// (market_threads, read here with the account cookie's own session; the list reads itself again while it is in view).
// Signed out, or with a session the database no longer takes, the site's sign-in, which draws this page again signed
// in. It opens whatever the launch switch says, is never in search engines and is never kept at the edge
// (lib/page-cache.ts).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = serverLocalize(T, locale);
  return pageMeta({ path: MK_INBOX, locale, noindex: true, title: `${t.inbox} · MicroMobility` });
}

export default async function MarketInboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = serverLocalize(T, locale);
  const at = await marketSite(locale);
  const session = await mkSession();
  const r = session ? await mkThreads(session) : null;
  const signedIn = !!session && !(r && !r.ok && r.error === "signin");
  return (
    <MkFrame locale={locale} at={at} narrow>
      <MkGate locale={locale} session={signedIn ? session : null}>
        <div className="mk-w3-top">
          <Link className="mk-link" href={MK_HOME}><MkIcon name="back" size={16} flip />{t.name}</Link>
        </div>
        <h1>{t.inbox}</h1>
        <Inbox initial={r && r.ok ? r.data.items.filter(mkHasId) : null} error={r && !r.ok ? { error: r.error, detail: r.detail } : null} fmt={inboxFmt(locale)} />
      </MkGate>
    </MkFrame>
  );
}
