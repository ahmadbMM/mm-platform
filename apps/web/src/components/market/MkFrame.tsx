import type { ReactNode } from "react";
import PageShell from "@/components/site/PageShell";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";
import { marketplaceOn } from "@/lib/site";
import "@/components/market/market.css";

// The frame of every Marketplace page (micromobility.sa/marketplace and everything under it): the site's header and
// footer around the page, on the paper background, with the Marketplace's own styles. The pages open by their address
// whatever the launch switch says (site_content 'marketplace.on'); the switch only decides whether the header, the
// search, the footer, My Account and the sitemap lead to them (lib/site.ts hiddenPages). They are ordinary pages of
// the site otherwise: while the whole site is Coming Soon the proxy sends a visitor to it, as from any page.

/** The site's state and settings for a Marketplace page: what the frame needs, the staff content (`content`, for
 *  lib/market/core.ts mkSettings) and whether the launch switch is on. */
export async function marketSite(locale: string) {
  const { content, previewing, hidden } = await pageState();
  const site = resolvePage(siteSchema, content, asLocale(locale));
  return { content, previewing, hidden, site, on: marketplaceOn(content) };
}
export type MarketSite = Awaited<ReturnType<typeof marketSite>>;

/** `narrow`: a form's or a thread's page (640px at most); without it the browse width (1320px). */
export default function MkFrame({ locale, at, narrow = false, children }: { locale: string; at: MarketSite; narrow?: boolean; children: ReactNode }) {
  return (
    <PageShell locale={locale} site={at.site} preview={at.previewing} hidden={at.hidden}>
      <div className="mk-page">
        <div className={`mk${narrow ? " mk-narrow" : ""}`}>{children}</div>
      </div>
    </PageShell>
  );
}
