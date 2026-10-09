import PageShell, { navFrom } from "@/components/site/PageShell";
import LearnAlone from "@/components/learn/LearnAlone";
import NoticeDialog from "@/components/privacy/NoticeDialog";
import "@/components/learn/learn.css";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { learnFrame } from "@/lib/learn-page";
import { bookingLink } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import ClaimCard from "./ClaimCard";

// micromobility.sa/?claim=<token> (app/[locale]/page.tsx): the waitlist claim card in the frame the
// Learn to ride sign-up uses - on its own, with the logo, the language and the Privacy Notice, while
// the site is Coming Soon (nothing on it leads into the closed site), and with the header and footer
// of every page once it is open (lib/learn-page.ts). "My Bookings" is the booking app's own
// (?tab=bookings), where the claimed ticket is.
const NOTICE = "wlc-notice";

export default async function ClaimPage({ locale, token }: { locale: string; token: string }) {
  const L = asLocale(locale);
  const { content, previewing, hidden } = await pageState();
  const site = resolvePage(siteSchema, content, L);
  let mine = bookingLink(navFrom(site).booking, locale);
  try { const u = new URL(navFrom(site).booking); u.searchParams.set("tab", "bookings"); mine = bookingLink(u.toString(), locale); } catch { /* the plain link */ }
  const page = <><ClaimCard token={token} locale={locale} mine={mine} /><NoticeDialog id={NOTICE} locale={locale} /></>;
  if (learnFrame(content, previewing) === "alone") return <LearnAlone locale={locale} company={site.legal.company} notice={NOTICE}>{page}</LearnAlone>;
  return <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>{page}</PageShell>;
}
