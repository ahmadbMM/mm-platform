import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import ForgotPanel from "@/components/account/ForgotPanel";
import { signupWords } from "@/components/account/Signup.words";
import "@/components/account/account.css";
import "@/components/account/signup.css";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";
import { SIGNIN_PATH, safeNext } from "@/lib/signup";

// micromobility.sa/forgot-password - Forgot password, as the booking app has it (no self-service reset: the owner,
// 2026-10-07): message us on WhatsApp from the account's number, a temporary password comes back, and the rider chooses
// their own at the next sign-in (components/account/ForgotPanel.tsx). The sign-in's own "Forgot password?" shows the
// same panel in place of its form; this address is where the booking app's hand-over for it (HandoffLink) leads. Back to
// sign in goes to ?next= (the page the rider came from, a path on this site) or the sign-in at /account. Never in
// search engines.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMeta({ path: "/forgot-password", locale, title: `${signupWords(locale).forgotTitle} · Micromobility`, noindex: true });
}

export default async function ForgotPasswordPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const asked = (await searchParams).next;
  const next = safeNext(typeof asked === "string" ? asked : "");
  const { content, previewing, hidden } = await pageState();
  const site = resolvePage(siteSchema, content, asLocale(locale));
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="ac">
        <section className="ac-card">
          <img src="/site/logo-dark.png" alt="Micromobility" className="ac-logo" />
          <ForgotPanel heading="h1" backHref={next || SIGNIN_PATH} />
        </section>
      </div>
    </PageShell>
  );
}
