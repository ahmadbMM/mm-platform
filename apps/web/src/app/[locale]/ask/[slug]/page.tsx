import type { Metadata } from "next";
import { cache } from "react";
import { T } from "@/components/ask/Ask.text";
import AskFrame, { SignedInAs, askSite } from "@/components/ask/AskFrame";
import AskPage from "@/components/ask/AskPage";
import "@/components/learn/learn.css";
import "@/components/account/account.css";
import "@/components/ask/ask.css";
import { serverLocalize } from "@/i18n/dicts";
import { askText } from "@/lib/ask";
import { askKey, askSession, readAskPage } from "@/lib/ask-server";
import { pageMeta } from "@/lib/seo";

// micromobility.sa/ask/<slug> - one page of questions: ask_page for this viewer (the account cookie's session when
// there is one; a staff preview's key from ?k=), handed to the browser's component, which draws every state the
// database can answer and keeps the results up to date (components/ask/AskPage.tsx). It opens whatever the site's
// state (proxy.ts, ASK_PAGE), is never kept at the edge (lib/page-cache.ts) and never in search results. A link shared
// in a chat previews with the page's own title and introduction, where the page shows them to a visitor with no account.
type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// One read for the page and for its title (generateMetadata), per request.
const load = cache((slug: string, id: string, token: string, key: string) => readAskPage(slug, id && token ? { id, token } : null, key || null));
async function read({ params, searchParams }: Props) {
  const [{ locale, slug }, sp, session] = await Promise.all([params, searchParams, askSession()]);
  const key = askKey(sp.k);
  const { view } = await load(slug, session?.id ?? "", session?.token ?? "", key ?? "");
  return { locale, slug, sp, session, key, view };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, slug, view } = await read(props);
  const name = view.head ? askText(locale, view.head.title_en, view.head.title_ar) : "";
  const intro = view.full ? askText(locale, view.full.page.intro_en, view.full.page.intro_ar) : "";
  return pageMeta({ path: `/ask/${slug}`, locale, noindex: true, title: `${name || serverLocalize(T, locale).listTitle} · Micromobility`, description: intro || undefined });
}

export default async function AskSlugPage(props: Props) {
  const { locale, slug, sp, session, key, view } = await read(props);
  const at = await askSite(locale);
  return (
    <AskFrame locale={locale} at={at}>
      <SignedInAs locale={locale} session={session} handoff={sp.handoff} />
      <AskPage locale={locale} slug={slug} initial={view} pageKey={key} create={at.create} />
    </AskFrame>
  );
}
