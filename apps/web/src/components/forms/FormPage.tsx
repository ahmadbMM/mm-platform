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
export default async function FormPage({ locale, path, search, children }: { locale: string; path: string; search: Record<string, string | string[] | undefined>; children: ReactNode }) {
  const { content, previewing, hidden } = await pageState();
  if (learnFrame(content, previewing) === "alone") {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(search)) for (const x of Array.isArray(v) ? v : v == null ? [] : [v]) q.append(k, x);
    q.set("classic", "1");
    redirect(`${path}?${q}`);
  }
  const site = resolvePage(siteSchema, content, asLocale(locale));
  return (
    <PageShell locale={locale} site={site} preview={previewing} hidden={hidden}>
      <div className="mmf-page">{children}</div>
    </PageShell>
  );
}
