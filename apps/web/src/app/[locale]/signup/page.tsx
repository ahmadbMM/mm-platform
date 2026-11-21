import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import SignupForm from "@/components/account/SignupForm";
import NoticeDialog from "@/components/privacy/NoticeDialog";
import { signupWords } from "@/components/account/Signup.words";
import "@/components/account/account.css";
import "@/components/account/signup.css";
import { siteSchema } from "@/content/pages/site";
import { getAccount } from "@/lib/account";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";
import { SIGNIN_PATH, safeNext, withNext } from "@/lib/signup";

// micromobility.sa/signup - Create account, as the booking app's own (its /signup; the user, 2026-11-19: "make sure all
// customers can do everything they want in the booking app to do it on the main website"): the title, the line for a
// visitor who already has an account ("Already have an account? Sign in", the site's sign-in at /account), and the
// form (components/account/SignupForm.tsx, made by api/account/signup). Once made, the site is signed in and goes on to
// ?next= (a path on this site, from the sign-in the visitor came from) or My Account; a visitor already signed in goes
// there at once. The Privacy Notice opens in a dialog on the page. Never in search engines.
const NOTICE = "su-notice";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMeta({ path: "/signup", locale, title: `${signupWords(locale).title} · Micromobility`, noindex: true });
}

export default async function SignupPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const asked = (await searchParams).next;
  const next = safeNext(typeof asked === "string" ? asked : "");
  const [{ content, previewing, hidden }, acct] = await Promise.all([pageState(), getAccount()]);
  if (acct) redirect(next || SIGNIN_PATH);
  const site = resolvePage(siteSchema, content, asLocale(locale));
  const w = signupWords(locale);
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="ac">
        <section className="ac-card su-card" aria-labelledby="su-h">
          <img src="/site/logo-dark.png" alt="Micromobility" className="ac-logo" />
          <h1 id="su-h">{w.title}</h1>
          <p className="su-switch">{w.have} <a href={withNext(SIGNIN_PATH, next)}>{w.signIn}</a></p>
          <SignupForm locale={locale} next={next} notice={NOTICE} />
        </section>
      </div>
      <NoticeDialog id={NOTICE} locale={locale} />
    </PageShell>
  );
}
