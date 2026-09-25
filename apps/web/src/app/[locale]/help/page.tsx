import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import HelpBody, { type HelpTab } from "@/components/help/HelpBody";
import "@/components/help/help.css";
import "@/components/site/message-form.css";
import { HELP_TOPICS, helpSchema } from "@/content/pages/help";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";
import { serverL } from "@/i18n/dicts";

// micromobility.sa/help - answers, WhatsApp and a call, and a message form whose messages land in
// the staff page (Messages).
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("help");
  const h = resolvePage(helpSchema, content, asLocale(locale));
  return pageMeta({ path: "/help", locale, title: `${S(h.intro.eyebrow)} · Micromobility`, description: S(h.intro.text), closed });
}

export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const { content, previewing, hidden } = await pageState("help");
  const site = resolvePage(siteSchema, content, L);
  const h = resolvePage(helpSchema, content, L);
  const tabs: HelpTab[] = HELP_TOPICS.map((id) => ({
    id, label: S(h.topics[`${id}Tab`]),
    items: list(h.topics[id]).map((x) => ({ q: S(x.q), a: S(x.a) })).filter((x) => x.q && x.a),
  })).filter((x) => x.items.length > 0);
  const phone = S(site.contact.phone).replace(/[^\d+]/g, "");
  const wa = S(site.social.whatsapp) || (phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : "");
  const tx = serverL(locale);
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <section className="hp">
        <div className="hp-ghost" aria-hidden="true">SUPPORT</div>
        <p className="hp-eyebrow">{S(h.intro.eyebrow)}</p>
        <h1>{S(h.intro.title)}</h1>
        <p className="hp-lead">{S(h.intro.text)}</p>
        <HelpBody
          locale={locale}
          tabs={tabs}
          form={{ title: S(h.contact.formTitle), text: S(h.contact.formText), button: S(h.contact.button), doneTitle: S(h.contact.doneTitle), doneText: S(h.contact.doneText) }}
        />
        {(wa || phone) && (
          <div className="hp-cta">
            <div>
              <h3>{S(h.contact.ctaTitle)}</h3>
              <p>{S(h.contact.ctaText)}</p>
            </div>
            <div className="hp-cta-btns">
              {wa && <a className="wa" href={wa} target="_blank" rel="noopener noreferrer">{tx("WhatsApp us", "واتساب")}</a>}
              {phone && <a className="call" href={`tel:${phone}`}>{tx("Call us", "اتصل بنا")}</a>}
            </div>
          </div>
        )}
      </section>
    </PageShell>
  );
}
