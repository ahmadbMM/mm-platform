import ToTop from "@/components/site/ToTop";
import { SOCIAL_ICONS } from "@/components/site/social-icons";
import { BOOKING_URL, bookingLink, pageOf } from "@/lib/links";
import { serverL } from "@/i18n/dicts";
import { localeInfo } from "@/i18n/locales";
import { phrase } from "@/i18n/tx";
import { riyadhClock } from "@/lib/workshop-days";

// The footer from SiteFooter.dc.html, as the design has it: the payment strip, the contact
// block with both branches, directions and the social marks, three columns of links, back to
// top, the trust line and the legal line. Everything in it is staff-editable (Website > Whole
// site > Footer); a link to a page staff have switched off is left out, and My Account opens
// the booking app until the site's own account page is on.
export type FooterLink = { label: string; href: string };
export type FooterContent = {
  contact: { address: string; mapsHref: string; jccName: string; jccAddress: string; jccHref: string; email: string; phone: string; hoursText: string };
  social: Record<string, string>;
  legal: { company: string; vat: string; cr: string; legalName: string; unified: string; address: string };
  payments: { name: string; logo: string }[];
  showroom: boolean;
  trust: string[];
  columns: { title: string; links: FooterLink[] }[];
};

const SOCIAL_NAMES: Record<string, { en: string; ar: string }> = {
  instagram: phrase("Instagram", "إنستغرام"), x: phrase("X", "إكس"), snapchat: phrase("Snapchat", "سناب شات"), tiktok: phrase("TikTok", "تيك توك"),
  youtube: phrase("YouTube", "يوتيوب"), facebook: phrase("Facebook", "فيسبوك"), whatsapp: phrase("WhatsApp", "واتساب"), telegram: phrase("Telegram", "تيليجرام"),
};
const SOCIAL_ORDER = ["instagram", "x", "snapchat", "tiktok", "youtube", "facebook", "whatsapp", "telegram"];

/** "+966566668818" as the design writes it: "+(966) 56 666 8818". */
function showPhone(p: string): string {
  const m = /^\+966(5\d)(\d{3})(\d{4})$/.exec(p.replace(/\s/g, ""));
  return m ? `+(966) ${m[1]} ${m[2]} ${m[3]}` : p;
}
/** The site page a link opens ("/help#returns" -> "help"), or "" for anything else. */
const Arrow = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>;

export default function SiteFooter({ locale, c, hidden = [], booking = BOOKING_URL }: { locale: string; c: FooterContent; hidden?: string[]; booking?: string }) {
  const tx = serverL(locale);
  const year = riyadhClock(new Date()).slice(0, 4);
  const socials = SOCIAL_ORDER.map((id) => [id, c.social[id]] as const).filter(([, href]) => !!href);
  const link = (l: FooterLink) => (pageOf(l.href) === "account" && hidden.includes("account") ? { ...l, href: bookingLink(booking, locale) } : l.href.startsWith(BOOKING_URL) || l.href.startsWith(booking) ? { ...l, href: bookingLink(l.href, locale) } : l);
  const columns = c.columns
    .map((col) => ({ ...col, links: col.links.map(link).filter((l) => l.label && l.href && !(pageOf(l.href) && pageOf(l.href) !== "account" && hidden.includes(pageOf(l.href)))) }))
    .filter((col) => col.links.length > 0);
  const pays = c.payments.filter((p) => p.logo);
  const hub = c.showroom && (
    <span key="hub" className="mm-foot-hub" role="img" aria-label={tx("Prepay at Showroom", "الدفع المسبق في المعرض")}>
      <svg viewBox="0 0 223 223" width="30" height="30" aria-hidden="true"><path d="M27.5 189 V49.75 A14.75 14.75 0 0 1 57 49.75 V170.25 A14.75 14.75 0 0 0 86.5 170.25 V49.75 A14.75 14.75 0 0 1 116 49.75 V165 A24 24 0 0 0 140 189 H195" fill="none" stroke="currentColor" strokeWidth="23.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span><span lang="ar">الدفع المسبق</span><b lang="ar">في المعرض</b><small>{tx("Prepay at Showroom", "الدفع في المعرض")}</small></span>
    </span>
  );
  // The design sets the showroom mark before the last payment mark (tabby).
  const strip = pays.map((p) => <img key={p.name + p.logo} src={p.logo} alt={p.name} className={`pay-${p.name.toLowerCase().replace(/[^a-z]/g, "")}`} />);
  if (hub) strip.splice(Math.max(0, strip.length - 1), 0, hub);
  return (
    <footer className="mm-foot" dir={localeInfo(locale).dir}>
      {strip.length > 0 && <div className="mm-foot-pay"><div>{strip}</div></div>}
      <div className="mm-foot-main">
        <div className="mm-foot-grid">
          <div className="mm-foot-brand">
            <span className="mm-foot-mark" role="img" aria-label="micromobility" />
            {c.contact.address && <p><span>{tx("Store", "المتجر")}:</span> {c.contact.address}</p>}
            {c.contact.jccAddress && <p><span>{c.contact.jccName || tx("Micromobility JCC Pop-up", "متجر JCC المؤقت")}:</span> {c.contact.jccAddress}</p>}
            {c.contact.email && <p><span>{tx("Email", "البريد")}:</span> <a href={`mailto:${c.contact.email}`}>{c.contact.email}</a></p>}
            {c.contact.phone && <p><span>{tx("Phone", "الجوال")}:</span> <a href={`tel:${c.contact.phone.replace(/\s/g, "")}`} className="mm-lat">{showPhone(c.contact.phone)}</a></p>}
            {c.contact.hoursText && <p className="mm-foot-hours"><span>{tx("Store Hours", "ساعات العمل")}:</span> {c.contact.hoursText}</p>}
            <div className="mm-foot-dirs">
              {c.contact.mapsHref && <a href={c.contact.mapsHref} target="_blank" rel="noopener noreferrer">{tx("Store directions", "اتجاهات المتجر")}<Arrow /></a>}
              {c.contact.jccHref && <a href={c.contact.jccHref} target="_blank" rel="noopener noreferrer">{tx("JCC Pop-up directions", "اتجاهات JCC")}<Arrow /></a>}
            </div>
            {socials.length > 0 && (
              <div className="mm-foot-social">
                {socials.map(([id, href]) => (
                  <a key={id} href={href} target="_blank" rel="noopener noreferrer" aria-label={tx(SOCIAL_NAMES[id].en, SOCIAL_NAMES[id].ar)}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={SOCIAL_ICONS[id]} /></svg>
                  </a>
                ))}
              </div>
            )}
          </div>
          {columns.map((col, i) => (
            <div key={i} className="mm-foot-col">
              <h2>{col.title}</h2>
              <div>{col.links.map((l, j) => <a key={j} href={l.href}>{l.label}</a>)}</div>
            </div>
          ))}
        </div>
        <div className="mm-foot-up"><ToTop label={tx("Back to top", "العودة للأعلى")} /></div>
        {c.trust.length > 0 && (
          <div className="mm-foot-trust">
            {c.trust.map((t, i) => (
              <span key={i}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#03ff89" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>{t}</span>
            ))}
          </div>
        )}
        <div className="mm-foot-bottom">
          <span>© {year} {c.legal.company}. {tx("All Rights Reserved", "جميع الحقوق محفوظة.")}</span>
          <span className="mm-lat">
            {c.legal.vat ? `${tx("VAT No.", "الرقم الضريبي")} ${c.legal.vat}` : ""}
            {c.legal.cr ? ` · ${tx("CR", "س.ت")} ${c.legal.cr}` : ""}
          </span>
        </div>
        {(c.legal.legalName || c.legal.address) && (
          <p className="mm-foot-legal">
            {[c.legal.legalName, c.legal.unified && `${tx("Unified No.", "الرقم الموحد")} ${c.legal.unified}`, c.legal.address].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </footer>
  );
}
