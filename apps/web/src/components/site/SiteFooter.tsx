import { Link } from "@/i18n/navigation";
import { BOOKING_URL, NAV_LINKS, PRIVACY_URL, pick } from "@/lib/links";

// The footer from SiteFooter.dc.html, with only what exists behind it: the sections that are
// live, the contact block and hours from the staff-editable site content, social links that
// have an address, and the legal line. No staff sign-in link - staff have their own address.
export type FooterContent = {
  contact: { address: string; mapsHref: string; jccName: string; jccAddress: string; jccHref: string; email: string; phone: string; hoursText: string };
  social: Record<string, string>;
  legal: { company: string; vat: string; cr: string };
};

const SOCIAL_NAMES: Record<string, { en: string; ar: string }> = {
  instagram: { en: "Instagram", ar: "إنستغرام" }, whatsapp: { en: "WhatsApp", ar: "واتساب" }, x: { en: "X", ar: "إكس" },
  tiktok: { en: "TikTok", ar: "تيك توك" }, snapchat: { en: "Snapchat", ar: "سناب شات" }, youtube: { en: "YouTube", ar: "يوتيوب" },
};

export default function SiteFooter({ locale, c }: { locale: string; c: FooterContent }) {
  const ar = locale === "ar";
  const L = (en: string, a: string) => (ar ? a : en);
  const year = new Date().getFullYear();
  const socials = Object.entries(c.social).filter(([, href]) => !!href);
  return (
    <footer className="mm-foot" dir={ar ? "rtl" : "ltr"}>
      <div className="mm-foot-grid">
        <div className="mm-foot-brand">
          <img src="/site/logo-mark.png" alt="Micromobility" width={46} height={30} />
          <p>{c.contact.address}</p>
          <p>{c.contact.hoursText}</p>
          <p><a href={`mailto:${c.contact.email}`} className="mm-lat">{c.contact.email}</a> · <a href={`tel:${c.contact.phone.replace(/\s/g, "")}`} className="mm-lat">{c.contact.phone}</a></p>
          {socials.length > 0 && (
            <div className="mm-foot-social">
              {socials.map(([id, href]) => (
                <a key={id} href={href} target="_blank" rel="noopener noreferrer">{pick(SOCIAL_NAMES[id] || { en: id, ar: id }, locale)}</a>
              ))}
            </div>
          )}
        </div>
        <div>
          <h4>{L("Explore", "استكشف")}</h4>
          <ul>
            {NAV_LINKS.map((l) => <li key={l.key}>{l.external ? <a href={l.href}>{pick(l, locale)}</a> : <Link href={l.href}>{pick(l, locale)}</Link>}</li>)}
          </ul>
        </div>
        <div>
          <h4>{L("Visit", "زيارتنا")}</h4>
          <ul>
            <li><a href={c.contact.mapsHref} target="_blank" rel="noopener noreferrer">{L("Store directions", "اتجاهات المتجر")}</a></li>
            <li><a href={c.contact.jccHref} target="_blank" rel="noopener noreferrer">{c.contact.jccName}</a></li>
            <li>{c.contact.jccAddress}</li>
          </ul>
        </div>
        <div>
          <h4>{L("Company", "الشركة")}</h4>
          <ul>
            <li><a href={BOOKING_URL}>{L("My Account", "حسابي")}</a></li>
            <li><a href={PRIVACY_URL}>{L("Privacy Notice", "إشعار الخصوصية")}</a></li>
          </ul>
        </div>
      </div>
      <div className="mm-foot-bottom">
        <span>© {year} {c.legal.company}. {L("All rights reserved.", "جميع الحقوق محفوظة.")}</span>
        <span className="mm-lat">
          {c.legal.vat ? `${L("VAT No.", "الرقم الضريبي")} ${c.legal.vat}` : ""}
          {c.legal.cr ? ` · ${L("CR", "س.ت")} ${c.legal.cr}` : ""}
        </span>
      </div>
    </footer>
  );
}
