import type { Metadata } from "next";
import PageShell from "@/components/site/PageShell";
import "@/components/experiences/experiences.css";
import "@/components/booking/booking.css";
import XpDetail from "@/components/experiences/XpDetail";
import { T } from "@/components/experiences/sx-B5.text";
import { serverL, serverLocalize } from "@/i18n/dicts";
import { pageMeta } from "@/lib/seo";
import { localHref } from "@/lib/links";
import { isRtl } from "@/i18n/locales";
import { whenText } from "@/lib/sx-B5";
import { ogImageOf, xpSession } from "@/lib/sx-B5-server";
import { XIc } from "@/components/experiences/sx-B5-icons";

// micromobility.sa/experiences/s/<session>: one session's own page (EM05-B; the Experiences build of 2026-11-18), the
// page a row of /experiences opens on a phone and the link a rider shares. Its preview (EF33) carries the kind's drawn
// picture, the session's name and its date, and never anyone's name (R7). A date that has passed, or one this visitor
// may not see, says so and leads back to the list.

type P = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { locale, id } = await params;
  const m = await xpSession(locale, id);
  const tx = serverL(locale);
  const path = `/experiences/s/${encodeURIComponent(id)}`;
  if (!m.item || !m.x) return pageMeta({ path, locale, title: `${tx("Experiences", "التجارب")} · MicroMobility`, noindex: true, closed: m.closed });
  const t = serverLocalize(T, locale);
  const it = m.item;
  const when = whenText(it, m.x, t);
  return pageMeta({
    path, locale, closed: m.closed,
    title: `${it.name} · ${it.day}`,
    description: [when, it.place?.held ? null : it.place?.name].filter(Boolean).join(" · "),
    image: ogImageOf(it.kind),
  });
}

export default async function XpSessionPage({ params }: P) {
  const { locale, id } = await params;
  const m = await xpSession(locale, id);
  const t = serverLocalize(T, locale);
  const list = localHref("/experiences", locale);
  return (
    <PageShell locale={locale} site={m.site} preview={m.previewing} hidden={m.hidden}>
      <div className="xp">
        <div className="xq-page">
          <a className="xq-back" href={list}><XIc name={isRtl(locale) ? "go" : "back"} size={16} />{t.back}</a>
          {m.item && m.x
            ? <XpDetail s={m.item} x={m.x} locale={locale} mode="page" />
            : <div className="xq-empty"><p>{t.gone}</p><a className="xq-btn2" href={list}>{t.back}</a></div>}
        </div>
      </div>
    </PageShell>
  );
}
