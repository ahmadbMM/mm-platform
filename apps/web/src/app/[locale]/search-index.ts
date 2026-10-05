"use server";

import { journalState } from "@/components/journal/journal-data";
import { aboutSchema } from "@/content/pages/about";
import { clubSchema } from "@/content/pages/club";
import { experiencesSchema } from "@/content/pages/experiences";
import { HELP_TOPICS, helpSchema } from "@/content/pages/help";
import { siteSchema } from "@/content/pages/site";
import { termsSchema } from "@/content/pages/terms";
import { asLocale, resolvePage } from "@/lib/content";
import { fill } from "@/lib/fill";
import { pageState } from "@/lib/page-state";

// What the header's search looks through besides the pages' names (components/site/SiteSearch.tsx):
// the Help answers, the About and Club questions, the Journal's articles and the Terms' clauses,
// in the visitor's language, from pages the visitor can open, and the Learn to ride sign-up (a page
// of Experiences' own, with no place in the menus). A server action, so it is read with the pages'
// own dictionaries; kept a minute per language, as staff edits are. While the site is Coming Soon a
// visitor can open none of them, so it answers nothing (a server action can be called by anyone,
// from anywhere); staff previewing the site search it as it will be.
/** `words`: more words it is found by, never shown. */
export type SearchItem = { title: string; text: string; href: string; words?: string };

// What someone looking for lessons might type, in English and Arabic (with and without the shadda).
const LEARN_WORDS = "learn learning lesson lessons beginner beginners teach teaching training first time balance kids children adults "
  + "تعلم تعلّم تعليم درس دروس مبتدئ مبتدئين تدريب أطفال الكبار";

type Sec = Record<string, unknown>;
const S = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? (v as Sec[]) : []);
const kept = new Map<string, { at: number; items: SearchItem[] }>();

export async function searchIndex(locale: string): Promise<SearchItem[]> {
  const L = asLocale(locale);
  const { content, closed, previewing, hidden } = await pageState();
  if (closed && !previewing) return [];
  const key = `${L}|${hidden.join(",")}`;
  const hit = kept.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.items;
  const on = (p: string) => !hidden.includes(p);
  const items: SearchItem[] = [];
  const qa = (rows: Sec[], href: string, values: Record<string, string> = {}) => {
    for (const x of rows) if (S(x.q)) items.push({ title: fill(S(x.q), values), text: fill(S(x.a), values), href });
  };
  if (on("help")) {
    const h = resolvePage(helpSchema, content, L);
    for (const t of HELP_TOPICS) qa(list(h.topics[t]), t === "faq" ? "/help" : `/help#${t}`);
  }
  if (on("about")) {
    const hours = S(resolvePage(siteSchema, content, L).contact.hoursText);
    qa(list(resolvePage(aboutSchema, content, L).faq.items), "/about", { hours });
  }
  if (on("club")) qa(list(resolvePage(clubSchema, content, L).faq.items), "/club");
  if (on("experiences")) {
    const l = resolvePage(experiencesSchema, content, L).learn;
    if (l.on) items.push({ title: l.eyebrow || l.title, text: l.taking ? l.teaserText : l.closedText, href: "/experiences/learn", words: LEARN_WORDS });
  }
  if (on("journal")) {
    const { posts } = await journalState(L);
    for (const p of posts) items.push({ title: p.title, text: p.excerpt, href: `/journal/${p.slug}` });
  }
  if (on("terms")) {
    for (const c of list(resolvePage(termsSchema, content, L).clauses.items)) if (S(c.title)) items.push({ title: S(c.title), text: S(c.body).replace(/^- /gm, ""), href: "/terms" });
  }
  kept.set(key, { at: Date.now(), items });
  return items;
}
