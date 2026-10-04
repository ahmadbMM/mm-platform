import type { MetadataRoute } from "next";
import { experiencesSchema } from "@/content/pages/experiences";
import { journalSchema } from "@/content/pages/journal";
import { resolvePage } from "@/lib/content-core";
import { toPosts } from "@/lib/journal";
import { LOCALES } from "@/i18n/locales";
import { SITE_URL, langPath, languageAlternates } from "@/lib/seo";
import { SWITCHED_PAGES, loadJournalContent, pageOn } from "@/lib/site";
import { pageState } from "@/lib/page-state";
import { loadCatalog, modelPath, subtypesOf, topCategories } from "@/lib/catalog";

// micromobility.sa/sitemap.xml: every page a visitor can open, in every language. Addresses carry
// no language, so each language is its own ?lang= address and every entry names all sixteen
// (hreflang), which is how search engines find the Arabic, Urdu and other versions at all.
// Empty while the site is Coming Soon; afterwards it lists Home, the Privacy Notice, the pages
// staff have switched on (not the account page, which is private), the Learn to ride sign-up
// while Experiences is on and staff offer lessons, the Journal's articles and the bike
// catalogue's categories, sub-types and models (never the fleet's tag pages).
const PRIVATE = new Set(["account"]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { content, closed } = await pageState();
  if (closed) return [];
  const paths = ["/", "/privacy", ...SWITCHED_PAGES.filter((p) => !PRIVATE.has(p) && pageOn(content, p)).map((p) => `/${p}`)];
  if (pageOn(content, "experiences") && resolvePage(experiencesSchema, content, "en").learn.on) paths.push("/experiences/learn");
  // Addresses that exist in some languages only: an article staff wrote in English alone is not on
  // the Arabic Journal (lib/journal.ts toPosts), so its Arabic address is neither listed nor named.
  const missing = new Map<string, string[]>();
  if (pageOn(content, "journal")) {
    // The articles' addresses, read in English (and Arabic, to see which exist there) - the
    // dictionary-free reader, so this route does not carry every language's text
    // (lib/content-core.ts). Same rule as the Journal's pages.
    const all = { ...(content ?? {}), ...((await loadJournalContent()) ?? {}) };
    const list = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
    const items = list(resolvePage(journalSchema, all, "en").posts.items);
    const inArabic = new Set(toPosts(list(resolvePage(journalSchema, all, "ar").posts.items), items).map((p) => p.slug));
    for (const p of toPosts(items, items)) {
      paths.push(`/journal/${p.slug}`);
      if (!inArabic.has(p.slug)) missing.set(`/journal/${p.slug}`, ["ar"]);
    }
  }
  if (pageOn(content, "bikes")) {
    // The catalogue's own pages; a fleet bike's tag page (/bikes/42) is never listed.
    const catalog = await loadCatalog();
    if (catalog) {
      for (const cat of topCategories(catalog)) paths.push(`/bikes/${cat.slug}`, ...subtypesOf(catalog, cat.id).map((s) => `/bikes/${cat.slug}/${s.slug}`));
      paths.push(...catalog.models.map((m) => modelPath(m, catalog.categories)));
    }
  }
  const abs = (p: string) => `${SITE_URL}${p}`;
  return paths.flatMap((path) => {
    const skip = missing.get(path) ?? [];
    const languages = Object.fromEntries(Object.entries(languageAlternates(path, skip)).map(([k, v]) => [k, abs(v)]));
    return LOCALES.filter((l) => !skip.includes(l.code)).map((l) => ({ url: abs(langPath(path, l.code)), alternates: { languages } }));
  });
}
