import type { ReactNode } from "react";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter, { type FooterContent } from "@/components/site/SiteFooter";
import PreviewBar from "@/components/site/PreviewBar";
import "@/components/site/site.css";

// The frame every inner page shares: header, the page, footer, and the staff preview bar.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");

export function footerFrom(site: Record<string, Sec>): FooterContent {
  const c = site.contact;
  return {
    contact: { address: S(c.address), mapsHref: S(c.mapsHref), jccName: S(c.jccName), jccAddress: S(c.jccAddress), jccHref: S(c.jccHref), email: S(c.email), phone: S(c.phone), hoursText: S(c.hoursText) },
    social: Object.fromEntries(Object.entries(site.social).map(([k, x]) => [k, S(x)])),
    legal: { company: S(site.legal.company), vat: S(site.legal.vat), cr: S(site.legal.cr) },
  };
}

/** `hidden`: the pages staff have not switched on, left out of the header and footer. */
export default function PageShell({ locale, site, preview, hidden = [], children }: { locale: string; site: Record<string, Sec>; preview: boolean; hidden?: string[]; children: ReactNode }) {
  const ar = locale === "ar";
  return (
    <div className="mm-site" dir={ar ? "rtl" : "ltr"}>
      <SiteNav locale={locale} hidden={hidden} />
      <main id="mm-main" style={{ paddingTop: 52 }}>{children}</main>
      <SiteFooter locale={locale} c={footerFrom(site)} hidden={hidden} />
      {preview && <PreviewBar locale={locale} />}
    </div>
  );
}
