import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import PageShell from "@/components/site/PageShell";
import { siteSchema } from "@/content/pages/site";
import { asLocale, resolvePage } from "@/lib/content";
import { learnFrame } from "@/lib/learn-page";
import { pageState } from "@/lib/page-state";
import "./forms.css";

// The frame a registration form is drawn in on the website: the header and footer every page has. The forms open
// whatever the site's state (proxy.ts); while the site is Coming Soon they must not lead into the closed site, so the
// address answers with the form's own page instead (?classic=1, the page the form's build writes), its question kept.
// `plain`: a form where nothing is bought (Petromin's, paid by the employer): the shell without the store's cart,
// payment marks and link columns (the research report "Petromin form design and function", 2026-11-11).
export default async function FormPage({ locale, path, search, plain = false, children }: { locale: string; path: string; search: Record<string, string | string[] | undefined>; plain?: boolean; children: ReactNode }) {
  const { content, previewing, hidden } = await pageState();
  if (learnFrame(content, previewing) === "alone") {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(search)) for (const x of Array.isArray(v) ? v : v == null ? [] : [v]) q.append(k, x);
    // the form's own page reads its language from ?lang (it never sees the site's cookie): the one the site resolved
    if (!q.has("lang")) q.set("lang", locale);
    q.set("classic", "1");
    redirect(`${path}?${q}`);
  }
  const site = resolvePage(siteSchema, content, asLocale(locale));
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden} plain={plain}>
      <div className="mmf-page">{children}</div>
    </PageShell>
  );
}
