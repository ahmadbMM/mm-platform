import type { Metadata } from "next";
import PageShell from "@/components/site/PageShell";
import BusinessBody, { type BizService } from "@/components/business/BusinessBody";
import "@/components/business/business.css";
import "@/components/site/message-form.css";
import { businessSchema } from "@/content/pages/business";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";
import { slugId } from "@/lib/slug";

// micromobility.sa/business - what we do for companies; enquiries land in the staff page (Messages).
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);
const lines = (v: unknown) => S(v).split("\n").map((x) => x.trim()).filter(Boolean);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState();
  const b = resolvePage(businessSchema, content, asLocale(locale));
  return { title: `${S(b.hero.eyebrow)} · Micromobility`, description: S(b.hero.text), robots: closed ? { index: false, follow: false } : undefined };
}

export default async function BusinessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const { content, previewing } = await pageState();
  const site = resolvePage(siteSchema, content, L);
  const b = resolvePage(businessSchema, content, L);
  const en = resolvePage(businessSchema, content, "en");
  const services: BizService[] = list(b.services.items).map((s, i) => ({
    id: slugId(S(list(en.services.items)[i]?.tab), `service-${i + 1}`), tab: S(s.tab), image: S(s.image), title: S(s.title), text: S(s.text), points: lines(s.points),
  })).filter((s) => s.tab && s.title);
  const logos = (v: unknown) => list(v).map((x) => ({ name: S(x.name), logo: S(x.logo) })).filter((x) => x.name || x.logo);
  return (
    <PageShell locale={locale} site={site} preview={previewing}>
      <div className="bz">
        <section className="bz-hero">
          <img src="/site/logo-dark.png" alt="Micromobility" />
          <span className="bz-eyebrow">{S(b.hero.eyebrow)}</span>
          <h1>{S(b.hero.title)}</h1>
          <p>{S(b.hero.text)}</p>
        </section>
        <BusinessBody
          locale={locale}
          services={services}
          highlights={list(b.highlights.items).map((h) => ({ value: S(h.value), label: S(h.label) })).filter((h) => h.value)}
          clientsTitle={S(b.logos.clientsTitle)} clients={logos(b.logos.clients)}
          partnersTitle={S(b.logos.partnersTitle)} partners={logos(b.logos.partners)}
          form={{ eyebrow: S(b.form.eyebrow), title: S(b.form.title), text: S(b.form.text), button: S(b.form.button), doneTitle: S(b.form.doneTitle), doneText: S(b.form.doneText) }}
        />
      </div>
    </PageShell>
  );
}
