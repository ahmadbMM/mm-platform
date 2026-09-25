import type { Metadata } from "next";
import PageShell from "@/components/site/PageShell";
import GalleryGrid from "@/components/gallery/GalleryGrid";
import "@/components/pages/pages.css";
import { gallerySchema } from "@/content/pages/gallery";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { pageState } from "@/lib/page-state";
import { serverL } from "@/i18n/dicts";

// micromobility.sa/gallery - the photos staff upload, with their captions and tags.
type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const { content, closed } = await pageState("gallery");
  const c = resolvePage(gallerySchema, content, asLocale(locale));
  return { title: `${S(c.hero.eyebrow)} · Micromobility`, description: S(c.hero.title), robots: closed ? { index: false, follow: false } : undefined };
}

export default async function GalleryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const L = asLocale(locale);
  const { content, previewing, hidden } = await pageState("gallery");
  const site = resolvePage(siteSchema, content, L);
  const c = resolvePage(gallerySchema, content, L);
  const photos = list(c.photos.items).map((p) => ({ src: S(p.image), caption: S(p.caption), tag: S(p.tag) })).filter((p) => p.src);
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="pg">
        <p className="pg-eyebrow">{S(c.hero.eyebrow)}</p>
        <h1>{S(c.hero.title)}</h1>
        <GalleryGrid photos={photos} allLabel={S(c.hero.all)} closeLabel={serverL(locale)("Close", "إغلاق")} />
      </div>
    </PageShell>
  );
}
