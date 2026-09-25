import { slugId } from "./slug";

// The Journal's articles as staff write them in the staff page: plain text, where a blank line
// starts a new paragraph, a line starting "## " is a heading and lines starting "- " make a list.
// No markup is ever read from the text, so an article cannot inject anything into the page.

export type Block = { h: string } | { p: string } | { ul: string[] };

export function parseBody(text: string): Block[] {
  const out: Block[] = [];
  for (const chunk of text.replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    let para: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (para.length) out.push({ p: para.join(" ") });
      if (list.length) out.push({ ul: list });
      para = [];
      list = [];
    };
    for (const l of lines) {
      if (l.startsWith("## ")) { flush(); out.push({ h: l.slice(3).trim() }); }
      else if (/^[-•]\s+/.test(l)) { if (para.length) { out.push({ p: para.join(" ") }); para = []; } list.push(l.replace(/^[-•]\s+/, "")); }
      else { if (list.length) { out.push({ ul: list }); list = []; } para.push(l); }
    }
    flush();
  }
  return out;
}

/** Minutes to read, at about 200 words a minute; at least one. */
export function readMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export type Post = { slug: string; title: string; tag: string; date: string; cover: string; excerpt: string; body: string; cta: string; ctaHref: string };

/** The articles to show, newest first: each named by its English title (the same address in both
 *  languages), a second article with the same title numbered, hidden ones left out. */
export function toPosts(items: Record<string, unknown>[], enItems: Record<string, unknown>[]): Post[] {
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  const ascii = (v: string) => v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0)).trim();
  // Every article's address is settled from the whole English list first - hidden ones and ones
  // without this language's text included - so an article has the same address on both pages,
  // publishing another never renames it, and a numbered address never collides with a real one.
  const taken = new Set<string>();
  const slugs = items.map((it, i) => {
    const base = slugId(S(enItems[i]?.title) || S(it.title), `article-${i + 1}`);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);
    return slug;
  });
  const posts: Post[] = [];
  items.forEach((it, i) => {
    if (it.show === false || !S(it.title) || !S(it.body)) return;
    const date = ascii(S(it.date));
    posts.push({ slug: slugs[i], title: S(it.title), tag: S(it.tag), date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "", cover: S(it.cover), excerpt: S(it.excerpt), body: S(it.body), cta: S(it.cta), ctaHref: S(it.ctaHref) });
  });
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}
