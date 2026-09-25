import { journalSchema } from "@/content/pages/journal";
import { asLocale, resolvePage } from "@/lib/content";
import { toPosts, type Post } from "@/lib/journal";
import { pageState } from "@/lib/page-state";
import { loadJournalContent } from "@/lib/site";
import { intlOf } from "@/i18n/locales";

// What both Journal pages need: the page state, and the Journal's own content (read apart from
// the rest of the site's content, see loadJournalContent), resolved for the page's language.
export async function journalState(locale: string) {
  const [state, journal] = await Promise.all([pageState("journal"), loadJournalContent()]);
  const content = { ...(state.content ?? {}), ...(journal ?? {}) };
  const L = asLocale(locale);
  const j = resolvePage(journalSchema, content, L);
  const en = resolvePage(journalSchema, content, "en");
  const list = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const posts: Post[] = toPosts(list(j.posts.items), list(en.posts.items));
  return { ...state, content, L, j, posts };
}

export const fmtDate = (iso: string, locale: string) =>
  iso ? new Intl.DateTimeFormat(intlOf(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "";
