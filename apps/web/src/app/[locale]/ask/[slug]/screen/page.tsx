import type { Metadata } from "next";
import { cache } from "react";
import { T } from "@/components/ask/Ask.text";
import AskScreen from "@/components/ask/AskScreen";
import "@/components/site/site.css";
import "@/components/ask/ask.css";
import { serverLocalize } from "@/i18n/dicts";
import { localeInfo } from "@/i18n/locales";
import { askText } from "@/lib/ask";
import { askKey, qrModules, readAskScreen } from "@/lib/ask-server";
import { SITE_URL, pageMeta } from "@/lib/seo";

// micromobility.sa/ask/<slug>/screen?k=<key> - a page on a TV or a projector (components/ask/AskScreen.tsx): the
// page as ask_screen answers it for the screen's own key, with no account, and nothing of the site around it - no
// header, no footer. A missing or wrong key says only that the link is not valid. It opens whatever the site's state
// (proxy.ts, ASK_PAGE); never kept at the edge (its address carries the key) and never in search results.
type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const load = cache((slug: string, key: string) => readAskScreen(slug, key || null));

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ locale, slug }, sp] = await Promise.all([params, searchParams]);
  const full = await load(slug, askKey(sp.k) ?? "");
  const name = full ? askText(locale, full.page.title_en, full.page.title_ar) : "";
  return pageMeta({ path: `/ask/${slug}/screen`, locale, noindex: true, title: `${name || serverLocalize(T, locale).listTitle} · Micromobility` });
}

export default async function AskScreenPage({ params, searchParams }: Props) {
  const [{ locale, slug }, sp] = await Promise.all([params, searchParams]);
  const key = askKey(sp.k);
  const full = await load(slug, key ?? "");
  if (!full || !key) {
    return <main id="mm-main" className="mm-site ask ask-screen ask-screen-bad" dir={localeInfo(locale).dir}><h1>{serverLocalize(T, locale).screenBad}</h1></main>;
  }
  // the link people answer at: the page's own address, on the site itself
  const link = `${SITE_URL}/ask/${full.page.slug}`;
  return <AskScreen locale={locale} slug={slug} screenKey={key} initial={full} asked={typeof sp.q === "string" ? sp.q : null} qr={qrModules(link)} link={link} />;
}
