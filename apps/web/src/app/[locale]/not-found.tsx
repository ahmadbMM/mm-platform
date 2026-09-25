import { getLocale } from "next-intl/server";
import PageShell from "@/components/site/PageShell";
import "@/components/pages/pages.css";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { localHref } from "@/lib/links";
import { pageState } from "@/lib/page-state";
import { serverL } from "@/i18n/dicts";

// The site's 404: an address with no page (the catch-all beside it), or an article or page that
// is gone. Kept out of search engines; offers the way back.
export default async function NotFound() {
  const locale = await getLocale();
  const tx = serverL(locale);
  const { content, previewing, hidden } = await pageState();
  const site = resolvePage(siteSchema, content, asLocale(locale));
  const title = tx("Page not found", "الصفحة غير موجودة");
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <title>{`${title} · Micromobility`}</title>
      <meta name="robots" content="noindex" />
      <div className="pg pg-missing">
        <p className="pg-eyebrow">404</p>
        <h1>{title}</h1>
        <p className="pg-lead">{tx("The page you're looking for doesn't exist or has moved.", "الصفحة التي تبحث عنها غير موجودة أو نُقلت.")}</p>
        <p><a className="pg-btn" href={localHref("/", locale)}>{tx("Back to home", "العودة إلى الرئيسية")}</a></p>
      </div>
    </PageShell>
  );
}
