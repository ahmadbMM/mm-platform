import type { ReactNode } from "react";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter, { type FooterContent } from "@/components/site/SiteFooter";
import PreviewBar from "@/components/site/PreviewBar";
import { localeInfo } from "@/i18n/locales";
import { BOOKING_URL, STORE_CART_URL } from "@/lib/links";
import "@/components/site/site.css";

// The frame every inner page shares: header, the page, footer, and the staff preview bar.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");

export function footerFrom(site: Record<string, Sec>): FooterContent {
  const c = site.contact, f = site.footer;
  const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);
  const links = (v: unknown) => list(v).map((l) => ({ label: S(l.label), href: S(l.href) }));
  return {
    contact: { address: S(c.address), mapsHref: S(c.mapsHref), jccName: S(c.jccName), jccAddress: S(c.jccAddress), jccHref: S(c.jccHref), email: S(c.email), phone: S(c.phone), hoursText: S(c.hoursText) },
    social: Object.fromEntries(Object.entries(site.social).map(([k, x]) => [k, S(x)])),
    legal: { company: S(site.legal.company), vat: S(site.legal.vat), cr: S(site.legal.cr), legalName: S(site.legal.legalName), unified: S(site.legal.unified), address: S(site.legal.address) },
    payments: list(f.payments).map((p) => ({ name: S(p.name), logo: S(p.logo) })),
    showroom: f.showroom === true,
    trust: list(f.trust).map((t) => S(t.text)).filter(Boolean),
    columns: [
      { title: S(f.shopTitle), links: links(f.shop) },
      { title: S(f.exploreTitle), links: links(f.explore) },
      { title: S(f.companyTitle), links: links(f.company) },
    ],
  };
}

/** What the header needs from the site's settings (Website > Whole site): its words and the
 *  addresses staff set, else the site's own. */
export function navFrom(site: Record<string, Sec>): { labels: Record<string, string>; booking: string; cart: string } {
  const links = site.links ?? {};
  return {
    labels: Object.fromEntries(Object.entries(site.menu ?? {}).map(([k, v]) => [k, S(v)])),
    booking: S(links.booking) || BOOKING_URL,
    cart: S(links.cart) || STORE_CART_URL,
  };
}

/** `hidden`: the pages staff have not switched on, left out of the header and footer. */
export default function PageShell({ locale, site, preview, hidden = [], children }: { locale: string; site: Record<string, Sec>; preview: boolean; hidden?: string[]; children: ReactNode }) {
  return (
    <div className="mm-site" dir={localeInfo(locale).dir}>
      <SiteNav locale={locale} hidden={hidden} {...navFrom(site)} />
      <main id="mm-main" style={{ paddingTop: 52 }}>{children}</main>
      <SiteFooter locale={locale} c={footerFrom(site)} hidden={hidden} booking={navFrom(site).booking} />
      {preview && <PreviewBar locale={locale} />}
    </div>
  );
}
