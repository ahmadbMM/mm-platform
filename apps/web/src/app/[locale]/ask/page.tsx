import type { Metadata } from "next";
import { T } from "@/components/ask/Ask.text";
import AskCodeBox from "@/components/ask/AskCodeBox";
import AskFrame, { SignedInAs, askSite } from "@/components/ask/AskFrame";
import AskSignIn from "@/components/ask/AskSignIn";
import "@/components/learn/learn.css";
import "@/components/account/account.css";
import "@/components/ask/ask.css";
import { serverL, serverLocalize } from "@/i18n/dicts";
import { Link } from "@/i18n/navigation";
import { askText, askWhen } from "@/lib/ask";
import { askSession, readAskList } from "@/lib/ask-server";
import { pageMeta } from "@/lib/seo";

// micromobility.sa/ask - "Have your say": the pages of questions that are open to this visitor (ask_list, with the
// account cookie's session when there is one), a box for a page's 6-digit code (the big screen shows it), and, for a
// visitor who is signed out, the sign-in and the way to an account - answering always needs one. It opens whatever
// the site's state (proxy.ts, ASK_PAGE), is never kept at the edge (lib/page-cache.ts) and never in search results.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMeta({ path: "/ask", locale, noindex: true, title: `${serverLocalize(T, locale).listTitle} · Micromobility` });
}

export default async function AskListPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const t = serverLocalize(T, locale);
  const tx = serverL(locale);
  const session = await askSession();
  const [at, listing] = await Promise.all([askSite(locale), readAskList(session)]);
  // signed out: no session cookie, or one the database no longer takes. With no answer at all, nobody is asked to sign in.
  const signedOut = !session || (listing.answered && !listing.signed);
  return (
    <AskFrame locale={locale} at={at}>
      <SignedInAs locale={locale} session={session} handoff={(await searchParams).handoff} />
      <div className="ask ask-page ask-list" data-ask-theme="light">
        <header className="ask-head"><h1>{t.listTitle}</h1></header>
        {listing.pages.length > 0 ? (
          <ul className="ask-open">
            {listing.pages.map((p) => (
              <li key={p.slug}>
                <Link className="ask-open-card" href={`/ask/${p.slug}`}>
                  <span className="ask-open-title" dir="auto">{askText(locale, p.title_en, p.title_ar)}</span>
                  {p.closes_at && <span className="ask-open-until"><time dateTime={p.closes_at}>{t.until(askWhen(p.closes_at, locale))}</time></span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="ask-open-none">{t.nothing}</p>}
        <AskCodeBox />
        {signedOut && (
          <section className="ask-box" aria-labelledby="ask-signin">
            <h2 id="ask-signin">{tx("Sign in to your account", "تسجيل الدخول إلى حسابك")}</h2>
            <AskSignIn locale={locale} create={at.create} back="/ask" />
          </section>
        )}
      </div>
    </AskFrame>
  );
}
