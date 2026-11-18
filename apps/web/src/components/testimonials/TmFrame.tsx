import type { ReactNode } from "react";
import LearnAlone from "@/components/learn/LearnAlone";
import PageShell from "@/components/site/PageShell";
import type { askSite } from "@/components/ask/AskFrame";

// The frame of the testimonials pages (micromobility.sa/testimonials and /testimonials/write). They open by their link
// whatever the site's state (proxy.ts, TESTIMONIALS_PAGE), as the Ask pages do: while the site is Coming Soon they stand
// alone (LearnAlone: the brand, the language, no way into the closed site), and once it is open they have the site's
// header and footer - the whole site's, cart included, as any page of it.
type Site = Awaited<ReturnType<typeof askSite>>;

export default function TmFrame({ locale, at, children }: { locale: string; at: Site; children: ReactNode }) {
  if (at.alone) return <LearnAlone locale={locale} company={at.site.legal.company} notice="tm-notice">{children}</LearnAlone>;
  return <PageShell locale={locale} site={at.site} preview={at.previewing} hidden={at.hidden}>{children}</PageShell>;
}
