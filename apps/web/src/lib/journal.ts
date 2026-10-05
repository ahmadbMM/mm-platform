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

/** Minutes to read, at about 200 words a minute; at least one. Chinese and Japanese are written
 *  without spaces, so their characters count at about 400 a minute instead. */
export function readMinutes(text: string): number {
  const cjk = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g;
  const chars = (text.match(cjk) ?? []).length;
  const words = text.replace(cjk, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words + chars / 2) / 200));
}

export type Post = { slug: string; title: string; tag: string; date: string; cover: string; excerpt: string; body: string; cta: string; ctaHref: string };

/** A day staff typed as YYYY-MM-DD (Arabic or Persian digits too), if it is a real day of the
 *  calendar; "" otherwise. "2026-25-09" would make the date formatter throw and take the whole page
 *  down, and "2026-09-31" would quietly read as 1 October. */
export function isoDay(v: string): string {
  const s = v.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0)).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : "";
}

/** An article's address from its slug or its title: lower case letters, digits and hyphens, cut
 *  between two words within 60 characters ("chain-care-on-the-coast-a-five-minute-routine"). */
export function articleSlug(s: string, fallback: string): string {
  const all = s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (all.length <= 60) return all || fallback;
  const end = all.slice(0, 61).lastIndexOf("-"); // a hyphen at 61 means the 60 end on a whole word
  return (end > 0 ? all.slice(0, end) : all.slice(0, 60)) || fallback;
}

/** The articles to show, newest first: each at the address staff gave it, else one made from its
 *  English title (the same address in both languages), a second article with the same address
 *  numbered, hidden ones left out. */
export function toPosts(items: Record<string, unknown>[], enItems: Record<string, unknown>[]): Post[] {
  const S = (v: unknown) => (typeof v === "string" ? v : "");
  // Every article's address is settled from the whole English list first - hidden ones and ones
  // without this language's text included - so an article has the same address on both pages,
  // publishing another never renames it, and a numbered address never collides with a real one.
  // An address staff set (the slug: one value in both languages) keeps the article's links
  // working when its title is edited.
  const taken = new Set<string>();
  const slugs = items.map((it, i) => {
    const base = articleSlug(S(enItems[i]?.slug) || S(it.slug), "") || articleSlug(S(enItems[i]?.title) || S(it.title), `article-${i + 1}`);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);
    return slug;
  });
  const posts: Post[] = [];
  items.forEach((it, i) => {
    if (it.show === false || !S(it.title) || !S(it.body)) return;
    posts.push({ slug: slugs[i], title: S(it.title), tag: S(it.tag), date: isoDay(S(it.date)), cover: S(it.cover), excerpt: S(it.excerpt), body: S(it.body), cta: S(it.cta), ctaHref: S(it.ctaHref) });
  });
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}
