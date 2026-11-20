import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MkFrame, { marketSite } from "@/components/market/MkFrame";
import MkGate from "@/components/market/MkGate";
import MkIcon from "@/components/market/MkIcon";
import { T, mkErrorText } from "@/components/market/Market.text";
import ThreadView from "@/components/market/w3/ThreadView";
import { T as W } from "@/components/market/w3.text";
import "@/components/market/w3.css";
import { serverLocalize } from "@/i18n/dicts";
import { Link } from "@/i18n/navigation";
import { MK_INBOX, inboxHref, listingIdOf, mkErrorKey } from "@/lib/market/core";
import { mkSession, mkThreadGet } from "@/lib/market/server";
import { inboxFmt } from "@/lib/market/w3-fmt";
import { pageMeta } from "@/lib/seo";

// micromobility.sa/marketplace/inbox/<thread>: one conversation of the signed-in account's (market_thread_get, read
// here with the account cookie's own session, which also marks it read; the page then asks again by itself while it is
// in view). An address that is not a thread's number is not found. A thread that is not this account's, or is gone,
// reads "This conversation is no longer available" - the page never says which. Signed out, the site's sign-in, which
// draws the page again signed in. Never in search engines, never kept at the edge (lib/page-cache.ts).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = serverLocalize(T, locale);
  return pageMeta({ path: MK_INBOX, locale, noindex: true, title: `${t.inbox} · Micromobility` });
}

export default async function MarketThreadPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id: raw } = await params;
  const id = listingIdOf(raw);
  if (!id) notFound();
  const t = serverLocalize(T, locale);
  const w = serverLocalize(W, locale);
  const at = await marketSite(locale);
  const session = await mkSession();
  const r = session ? await mkThreadGet(session, id, null) : null;
  const signedIn = !!session && !(r && !r.ok && r.error === "signin");
  return (
    <MkFrame locale={locale} at={at} narrow>
      <MkGate locale={locale} session={signedIn ? session : null}>
        {r && r.ok ? <ThreadView initial={r.data} fmt={inboxFmt(locale)} /> : r && (
          <div className="mk-w3-thread">
            <Link className="mk-link mk-w3-back" href={MK_INBOX}><MkIcon name="back" size={16} flip />{t.inbox}</Link>
            <div className="mk-empty mk-w3-none">
              <p className={r.error === "gone" ? undefined : "mk-err"} role={r.error === "gone" ? undefined : "alert"}>
                {r.error === "gone" ? w.threadGone : r.error === "generic" ? w.threadFail : mkErrorText(t, mkErrorKey(r.error, r.detail))}
              </p>
              {r.error !== "gone" && r.error !== "absent" && <a className="mk-btn2" href={inboxHref(id)}>{t.retry}</a>}
            </div>
          </div>
        )}
      </MkGate>
    </MkFrame>
  );
}
