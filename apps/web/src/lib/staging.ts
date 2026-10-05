import type { Metadata } from "next";

// Staging (staging.micromobility.sa, wrangler.jsonc env "staging", MM_ENV=staging): every tab title
// starts with "[Staging]", so a staging tab is never taken for the real site. worker.js used to add
// it to the page's HTML only; the page's own script then drew the title it was sent and the prefix
// was gone after a moment (and on every page reached inside the site). So the pages carry it
// themselves - the language layout's title template, and the titles a page writes by hand - and the
// Worker adds it only where a page has not (the registration forms, plain documents).

export const STAGING_PREFIX = "[Staging] ";

/** Whether this is staging: the Worker's variable at run time (OpenNext copies it into
 *  process.env), or the build's (CI builds the staging branch with it). */
export const isStaging = (): boolean => process.env.MM_ENV === "staging";

/** A title as this deployment shows it: "[Staging] " in front on staging, once. */
export const stagingTitle = (title: string): string => (isStaging() && !title.startsWith(STAGING_PREFIX) ? STAGING_PREFIX + title : title);

/** The language layout's title on staging: a template every page's own title is put into, and no
 *  title of its own (an empty default draws no <title>, so a page that writes one by hand still has
 *  only one). Nothing elsewhere. */
export function layoutTitle(): Pick<Metadata, "title"> {
  return isStaging() ? { title: { template: `${STAGING_PREFIX}%s`, default: "" } } : {};
}

type TitleText = { text: string; lastInTextNode: boolean; remove(): void; replace(content: string, options?: { html?: boolean }): void };

/** worker.js's HTMLRewriter handler for <title>: the whole title is gathered (Cloudflare hands text
 *  over in pieces that can split "[Staging]" itself) and given the prefix unless it starts with it. */
export function prefixTitles(): { text(t: TitleText): void } {
  let buf = "";
  return {
    text(t) {
      buf += t.text;
      if (!t.lastInTextNode) { t.remove(); return; }
      const whole = buf;
      buf = "";
      // the source text as it was written (entities and all), so it is put back as markup
      t.replace(!whole || whole.startsWith(STAGING_PREFIX.trim()) ? whole : STAGING_PREFIX + whole, { html: true });
    },
  };
}
