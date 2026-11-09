import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import PageShell from "@/components/site/PageShell";
import TrackForm from "@/components/store/TrackForm";
import { storeState } from "@/components/store/store-data";
import "@/components/experiences/experiences.css";
import "@/components/store/store.css";

// micromobility.sa/store/track - an order found by its number and the mobile it was placed with. It answers
// whether the store is open or not, for orders placed before it closed.
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const s = await storeState(locale);
  return pageMeta({ path: "/store/track", locale, title: `${s.t.trackTitle} · Micromobility`, noindex: true });
}

export default async function TrackPage({ params }: Props) {
  const { locale } = await params;
  const s = await storeState(locale);
  return (
    <PageShell locale={locale} site={s.site} preview={s.previewing} hidden={s.hidden}>
      <div className="st st-narrow">
        <h1 className="st-title">{s.t.trackTitle}</h1>
        <p className="st-lead">{s.t.trackLead}</p>
        <TrackForm />
      </div>
    </PageShell>
  );
}
