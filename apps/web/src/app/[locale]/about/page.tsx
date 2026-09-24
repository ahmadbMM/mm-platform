import type { Metadata } from "next";
import PageShell from "@/components/site/PageShell";
import MessageForm from "@/components/site/MessageForm";
import OpenNow from "@/components/home/OpenNow";
import "@/components/about/about.css";
import "@/components/site/message-form.css";
import { aboutSchema } from "@/content/pages/about";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { fill } from "@/lib/fill";
import { localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { slugId } from "@/lib/slug";

// micromobility.sa/about - who we are (the company profile's own story, numbers, vision, mission
// and values), where to find us, visitor questions, the contact details with a live open / closed
// sign and a map, and "Join the team": an application that lands in the staff page's Messages.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);
const N = (v: unknown) => (typeof v === "number" ? v : 0);

const SOCIAL: Record<string, [string, string]> = {
  instagram: ["Instagram", "إنستغرام"], x: ["X", "إكس"], tiktok: ["TikTok", "تيك توك"], snapchat: ["Snapchat", "سناب شات"], youtube: ["YouTube", "يوتيوب"],
};

/** The site page a link opens (/club, /en/club#x), for leaving out links to pages that are off. */
const pageOfLink = (href: string) => (href.match(/^\/(?:(?:en|ar)\/)?([a-z_]+)(?:[/?#]|$)/) || [])[1] || "";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("about");
  const c = resolvePage(aboutSchema, content, asLocale(locale));
  return { title: `${S(c.hero.eyebrow)} · Micromobility`, description: S(c.hero.text), robots: closed ? { index: false, follow: false } : undefined };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const ar = L === "ar";
  const { content, previewing, hidden } = await pageState("about");
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(aboutSchema, content, L);
  const en = resolvePage(aboutSchema, content, "en");
  const arrow = ar ? "←" : "→";
  const shown = (href: string) => !hidden.includes(pageOfLink(href));

  const contact = site.contact;
  const hours = S(contact.hoursText);
  const numbers = list(c.hero.numbers).filter((x) => S(x.value) && S(x.label));
  const values = list(c.story.values).filter((x) => S(x.title));
  const places = list(c.tour.items).filter((x) => S(x.name));
  const brands = list(c.tour.brands).map((x) => S(x.name)).filter(Boolean);
  const cards = list(c.links.items).filter((x) => S(x.title) && S(x.href) && shown(S(x.href)));
  const faq = list(c.faq.items).filter((x) => S(x.q) && S(x.a));
  const socials = Object.entries(site.social).filter(([k, v]) => SOCIAL[k] && S(v));
  const whatsapp = S(site.social.whatsapp);
  const messageHref = S(c.contact.messageHref);
  const mapQuery = S(c.contact.mapQuery).trim();
  // A role's topic is made from its English title ("ride-captain"), so the staff page reads the
  // same topic whichever language the applicant used; "general" is an application for any role.
  const enRoles = list(en.jobs.roles);
  const roles = list(c.jobs.roles).map((r, i) => ({ title: S(r.title), text: S(r.text), id: slugId(S(enRoles[i]?.title) || S(r.title), `role-${i + 1}`) })).filter((x) => x.title);
  const topics = [...roles.map((r) => ({ id: r.id, label: r.title })), { id: "general", label: S(c.jobs.anyRole) }];
  const dt = (e: string, a: string) => <dt>{ar ? a : e}</dt>;

  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="ab">
        <section className="ab-hero">
          <p className="ab-eyebrow">{S(c.hero.eyebrow)}</p>
          <h1>{S(c.hero.title)}</h1>
          <p className="ab-lead">{S(c.hero.text)}</p>
        </section>

        {numbers.length > 0 && (
          <section className="ab-stats" aria-label={ar ? "بالأرقام" : "In numbers"}>
            {numbers.map((x, i) => <div key={i}><strong>{S(x.value)}</strong><span>{S(x.label)}</span></div>)}
          </section>
        )}

        <section className="ab-vm">
          {S(c.story.vision) && <div className="ab-vm-dark"><p className="ab-eyebrow">{S(c.story.visionTitle)}</p><p>{S(c.story.vision)}</p></div>}
          {S(c.story.mission) && <div className="ab-vm-light"><p className="ab-eyebrow">{S(c.story.missionTitle)}</p><p>{S(c.story.mission)}</p></div>}
        </section>

        {values.length > 0 && (
          <section className="ab-sec" aria-labelledby="ab-values-h">
            <h2 id="ab-values-h">{S(c.story.valuesTitle)}</h2>
            <div className="ab-values">
              {values.map((v, i) => (
                <div key={i}><span className="ab-tag">{String(i + 1).padStart(2, "0")}</span><h3>{S(v.title)}</h3>{S(v.text) && <p>{S(v.text)}</p>}</div>
              ))}
            </div>
          </section>
        )}

        {places.length > 0 && (
          <section className="ab-sec" aria-labelledby="ab-tour-h">
            <p className="ab-eyebrow">{S(c.tour.eyebrow)}</p>
            <h2 id="ab-tour-h">{S(c.tour.title)}</h2>
            <div className="ab-tour">
              {places.map((x, i) => (
                <div key={i}>
                  {S(x.image) ? <div className="ab-tour-img" role="img" aria-label={S(x.name)} style={{ backgroundImage: `url('${S(x.image)}')` }} /> : <div className="ab-tour-img" aria-hidden="true" />}
                  <div className="ab-tour-cap"><strong className="ab-num">{String(i + 1).padStart(2, "0")}</strong><div><strong>{S(x.name)}</strong>{S(x.text) && <span>{S(x.text)}</span>}</div></div>
                </div>
              ))}
            </div>
            {brands.length > 0 && (
              <>
                <p className="ab-eyebrow ab-brands-h">{S(c.tour.brandsTitle)}</p>
                <div className="ab-brands">{brands.map((b, i) => <span key={i} lang="en">{b}</span>)}</div>
              </>
            )}
          </section>
        )}

        {cards.length > 0 && (
          <section className="ab-sec" aria-label={S(c.links.eyebrow)}>
            <p className="ab-eyebrow">{S(c.links.eyebrow)}</p>
            <div className="ab-links">
              {cards.map((x, i) => (
                <a key={i} href={localHref(S(x.href), locale)}>
                  <strong>{S(x.title)}</strong>
                  {S(x.text) && <span>{S(x.text)}</span>}
                  {S(x.cta) && <em>{S(x.cta)} <span aria-hidden="true">{arrow}</span></em>}
                </a>
              ))}
            </div>
          </section>
        )}

        {faq.length > 0 && (
          <section className="ab-sec ab-faq-sec" aria-labelledby="ab-faq-h">
            <p className="ab-eyebrow">{S(c.faq.eyebrow)}</p>
            <h2 id="ab-faq-h">{S(c.faq.title)}</h2>
            <div className="ab-faq">
              {faq.map((x, i) => <details key={i} open={i === 0}><summary>{fill(S(x.q), { hours })}</summary><p>{fill(S(x.a), { hours })}</p></details>)}
            </div>
          </section>
        )}

        <section className="ab-contact" id="contact" aria-labelledby="ab-contact-h">
          <div className="ab-contact-card">
            <div className="ab-contact-head">
              <h2 id="ab-contact-h">{S(c.contact.title)}</h2>
              <OpenNow openHour={N(contact.openHour)} closeHour={N(contact.closeHour)} fridayClosed={contact.fridayClosed === true} ar={ar} />
            </div>
            <dl>
              {S(contact.address) && <div>{dt("Store", "المتجر")}<dd>{S(contact.mapsHref) ? <a href={S(contact.mapsHref)} target="_blank" rel="noopener noreferrer">{S(contact.address)}</a> : S(contact.address)}</dd></div>}
              {S(contact.jccName) && <div>{dt("Second branch", "الفرع الثاني")}<dd>{S(contact.jccHref) ? <a href={S(contact.jccHref)} target="_blank" rel="noopener noreferrer">{S(contact.jccName)}</a> : S(contact.jccName)}{S(contact.jccAddress) && <small>{S(contact.jccAddress)}</small>}</dd></div>}
              {S(contact.phone) && <div>{dt("Phone", "الجوال")}<dd><a href={`tel:${S(contact.phone).replace(/\s/g, "")}`} className="mm-lat">{S(contact.phone)}</a></dd></div>}
              {S(contact.email) && <div>{dt("Email", "البريد")}<dd><a href={`mailto:${S(contact.email)}`} className="mm-lat">{S(contact.email)}</a></dd></div>}
              {hours && <div>{dt("Hours", "ساعات العمل")}<dd>{hours}</dd></div>}
              {socials.length > 0 && <div>{dt("Follow us", "تابعنا")}<dd className="ab-social">{socials.map(([k, v]) => <a key={k} href={S(v)} target="_blank" rel="noopener noreferrer">{SOCIAL[k][ar ? 1 : 0]}</a>)}</dd></div>}
            </dl>
            <div className="ab-contact-btns">
              {whatsapp && S(c.contact.waBtn) && <a className="ab-wa" href={whatsapp} target="_blank" rel="noopener noreferrer">{S(c.contact.waBtn)}</a>}
              {messageHref && S(c.contact.messageBtn) && shown(messageHref) && <a className="ab-line" href={localHref(messageHref, locale)}>{S(c.contact.messageBtn)}</a>}
            </div>
          </div>
          {c.contact.showMap === true && mapQuery && (
            <iframe className="ab-map" title={S(c.contact.title)} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&hl=${L}&output=embed`} />
          )}
        </section>

        {(S(site.legal.legalName) || S(site.legal.cr)) && (
          <section className="ab-company" aria-labelledby="ab-company-h">
            <h2 id="ab-company-h">{ar ? "بيانات الشركة" : "Company details"}</h2>
            <dl>
              {S(site.legal.legalName) && <div>{dt("Legal name", "الاسم النظامي")}<dd>{S(site.legal.legalName)}</dd></div>}
              {S(site.legal.cr) && <div>{dt("Commercial registration", "السجل التجاري")}<dd className="mm-lat">{S(site.legal.cr)}</dd></div>}
              {S(site.legal.unified) && <div>{dt("Unified number", "الرقم الموحد")}<dd className="mm-lat">{S(site.legal.unified)}</dd></div>}
              {S(site.legal.vat) && <div>{dt("VAT number", "الرقم الضريبي")}<dd className="mm-lat">{S(site.legal.vat)}</dd></div>}
              {S(site.legal.address) && <div>{dt("Registered address", "العنوان المسجل")}<dd>{S(site.legal.address)}{S(site.legal.shortAddress) && <small className="mm-lat">{ar ? "العنوان المختصر" : "Short address"} {S(site.legal.shortAddress)}</small>}</dd></div>}
            </dl>
          </section>
        )}

        <section className="ab-jobs" id="jobs" aria-labelledby="ab-jobs-h">
          <div className="ab-jobs-card">
            <div className="ab-jobs-info">
              <h2 id="ab-jobs-h">{S(c.jobs.title)}</h2>
              {roles.length > 0 ? (
                <>
                  <p>{S(c.jobs.rolesTitle)}</p>
                  <ul>{roles.map((r) => <li key={r.id}><strong>{r.title}</strong>{r.text && <span>{r.text}</span>}</li>)}</ul>
                </>
              ) : (
                <p>{S(c.jobs.noRoles)}</p>
              )}
            </div>
            <div className="ab-jobs-form">
              <MessageForm locale={locale} kind="jobs" topic="general" topics={topics} topicLabel={ar ? "الوظيفة" : "Role"} placeholder={S(c.jobs.placeholder)}
                sendLabel={S(c.jobs.button)} doneTitle={S(c.jobs.doneTitle)} doneText={S(c.jobs.doneText)} />
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
