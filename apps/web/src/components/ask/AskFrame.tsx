import type { ReactNode } from "react";
import LearnAlone from "@/components/learn/LearnAlone";
import PageShell, { navFrom } from "@/components/site/PageShell";
import SignOut from "@/components/account/SignOut";
import { siteSchema } from "@/content/pages/site";
import { serverL } from "@/i18n/dicts";
import type { Session } from "@/lib/account-core";
import { asLocale, resolvePage } from "@/lib/content";
import { fill } from "@/lib/fill";
import { accountLabel, sessionProfile } from "@/lib/handoff";
import { learnFrame } from "@/lib/learn-page";
import { bookingLink } from "@/lib/links";
import { pageState } from "@/lib/page-state";

// What the Ask pages share on the server (micromobility.sa/ask and /ask/<slug>). They open whatever the site's state
// (proxy.ts, ASK_PAGE), like the Privacy Notice: while the site is Coming Soon they stand alone (LearnAlone: the
// brand, the language, no way into the closed site), and once it is open they have the site's header and footer.

/** The site's state and settings for an Ask page, and where an account is created: the booking app (as staff set its
 *  address), which hands the rider back here signed in (?handoff=site; api/account/handoff). */
export async function askSite(locale: string) {
  const { content, previewing, hidden } = await pageState();
  const site = resolvePage(siteSchema, content, asLocale(locale));
  const create = bookingLink(`${navFrom(site).booking.replace(/[?#].*$/, "")}?handoff=site&auth=signup`, locale);
  return { alone: learnFrame(content, previewing) === "alone", previewing, hidden, site, create };
}
type Site = Awaited<ReturnType<typeof askSite>>;

export default function AskFrame({ locale, at, children }: { locale: string; at: Site; children: ReactNode }) {
  if (at.alone) return <LearnAlone locale={locale} company={at.site.legal.company} notice="ask-notice">{children}</LearnAlone>;
  return <PageShell locale={locale} site={at.site} preview={at.previewing} hidden={at.hidden} plain>{children}</PageShell>;
}

/** Back from creating an account (the booking app's hand-back lands with ?handoff=done): the page says whom this
 *  browser is signed in as, as the account page does - a hand-back link is anyone's to pass on, and an answer goes
 *  under the account that is signed in. Nothing for any other visit, or when the account could not be read. */
export async function SignedInAs({ locale, session, handoff }: { locale: string; session: Session | null; handoff: unknown }) {
  if (handoff !== "done" || !session) return null;
  const who = await sessionProfile(session);
  if (!who || who === "none") return null;
  const tx = serverL(locale);
  return (
    <p className="ask-who" role="status">
      <span>{fill(tx("You are signed in as {who}. If this is not your account, sign out.", "أنت مسجّل الدخول باسم {who}. إن لم يكن هذا حسابك، فسجّل الخروج."), { who: accountLabel(who) })}</span>
      <SignOut label={tx("Sign out", "تسجيل الخروج")} />
    </p>
  );
}
