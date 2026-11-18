// The header search's product results, read the way a shopper in Jeddah types (the user, 2026-11-18: "do all", N26):
// Arabic written with or without hamza, taa marbuta, alef maqsura, diacritics or the tatweel, Arabic or Persian digits,
// the article "ال", Arabic and English words for the same thing (دراجة, سيكل, bike) and a slip of the finger ("garmn",
// "دراجه"). Pure and browser-safe: components/site/SiteSearch.tsx runs it over the store's items as the visitor types
// (app/[locale]/search-index.ts gives each product its name in both languages, brand, tagline and category words).

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g; // harakat, shadda, sukun, Quranic marks, tatweel
const LATIN_MARKS = /[̀-ͯ]/g;

/** The text as the search compares it: lower case, no diacritics in either script, one form for each Arabic letter that
 *  is written several ways (أ إ آ ٱ as ا, ة as ه, ى as ي, ؤ as و, ئ as ي), Western digits. */
export function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(LATIN_MARKS, "")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** One word as the search keeps it: normalised, and an Arabic word of five letters or more without its "ال"
 *  ("الدراجه" and "دراجه" are one word). */
const stem = (w: string) => (w.length >= 5 && w.startsWith("ال") && /^[؀-ۿ]+$/.test(w) ? w.slice(2) : w);

/** The words of a text, normalised: runs of letters and digits ("rtl515", "da54"). */
export function words(text: string): string[] {
  return (normalise(text).match(/[\p{L}\p{N}]+/gu) ?? []).map(stem);
}

/** Words that mean the same thing to a shopper, in English, Arabic and the Gulf's own words for them. A word typed finds
 *  every word of its group. Brands' Arabic spellings are here too, so "قارمن" finds Garmin. */
const GROUPS: readonly string[][] = [
  ["bike", "bikes", "bicycle", "bicycles", "cycle", "cycles", "cycling", "دراجه", "دراجات", "سيكل", "سيكيل", "سايكل", "بسكليت", "عجله", "عجلات"],
  ["road", "طريق", "طرق", "رود"],
  ["mountain", "mtb", "جبليه", "جبلي", "جبل"],
  ["kids", "kid", "child", "children", "junior", "اطفال", "طفل", "صغار"],
  ["electric", "ebike", "كهربائيه", "كهربائي", "كهربا"],
  ["helmet", "helmets", "خوذه", "خوذ", "هلمت"],
  ["light", "lights", "lamp", "اضاءه", "ضوء", "اضواء", "كشاف", "لمبه", "انوار"],
  ["radar", "رادار"],
  ["lock", "locks", "قفل", "اقفال"],
  ["pump", "منفاخ", "نفاخ", "منفخ"],
  ["gloves", "glove", "قفاز", "قفازات", "جوانتي"],
  ["jersey", "shirt", "tshirt", "قميص", "تيشيرت", "تيشرت", "بلوزه", "فانيله"],
  ["shorts", "short", "شورت"],
  ["cap", "hat", "قبعه", "كاب", "طاقيه"],
  ["bottle", "قاروره", "مطاره", "زمزميه"],
  ["computer", "gps", "عداد", "كمبيوتر"],
  ["garmin", "قارمن", "جارمن", "غارمن"],
  ["alvas", "الفاس", "فاس"],
  ["gift", "voucher", "هديه", "هدايا", "قسيمه"],
  ["tyre", "tire", "tyres", "tires", "كفر", "كفرات", "اطار", "اطارات"],
  ["saddle", "seat", "سرج", "مقعد"],
  ["pedals", "pedal", "بدال", "بدالات", "دواسه", "دواسات"],
  ["shoes", "shoe", "حذاء", "جزمه"],
  ["bag", "حقيبه", "شنطه"],
  ["accessories", "accessory", "اكسسوارات", "اكسسوار", "ملحقات"],
  ["apparel", "clothes", "clothing", "ملابس", "لبس"],
].map((g) => g.map((w) => stem(normalise(w))));

/** How far apart two words are: letters added, taken away, changed or two side by side swapped (each one step). */
export function distance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m + n;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[m][n];
}

/** The slips a word of this length may carry and still be the word: none up to three letters, one up to six, two from
 *  seven. A word with a digit in it is a model name and must be typed as it is. */
const slips = (w: string) => (/\d/.test(w) ? 0 : w.length <= 3 ? 0 : w.length <= 6 ? 1 : 2);

/** How well one typed word finds one of an item's words: 3 the same word, 2 the start of it (typing goes on), 1 the
 *  word with a slip or two, 0 not at all. */
function wordScore(q: string, w: string): number {
  if (q === w) return 3;
  if (q.length >= 2 && w.startsWith(q)) return 2;
  const k = slips(q);
  if (k && Math.abs(q.length - w.length) <= k && distance(q, w) <= k) return 1;
  // a slip in a word still being typed: its start with the slip
  if (k && w.length > q.length && distance(q, w.slice(0, q.length)) <= Math.min(1, k)) return 1;
  return 0;
}

/** The words a typed word stands for: itself, and every word of a group it is (or nearly is) one of. */
function alternatives(q: string): { word: string; own: boolean }[] {
  const out = [{ word: q, own: true }];
  for (const g of GROUPS) {
    if (g.some((w) => w === q || (q.length >= 4 && wordScore(q, w) >= 1 && !(w.startsWith(q) && q.length < w.length - 2)))) {
      for (const w of g) if (w !== q) out.push({ word: w, own: false });
    }
  }
  return out;
}

/** An item the search can find: what is shown (its title) and what else it is found by (its words, never shown). */
export type Findable = { title: string; text?: string; words?: string };

/** The items that answer what was typed, best first (ties in the items' own order): every typed word must find a word of
 *  the item, its title counting more than its other words, a word of its own more than a word of its group. Two
 *  characters or fewer typed find nothing. */
export function findProducts<T extends Findable>(items: readonly T[], typed: string): T[] {
  const qs = words(typed);
  if (normalise(typed).trim().length < 2 || !qs.length) return [];
  const alts = qs.map(alternatives);
  const scored: { item: T; score: number; at: number }[] = [];
  items.forEach((item, at) => {
    const title = words(item.title);
    const rest = words(`${item.text ?? ""} ${item.words ?? ""}`);
    // a model name written apart in the item ("Edge 850") is found typed together ("edge850")
    const joined = title.slice(1).map((w, i) => title[i] + w);
    let score = 0;
    for (const qa of alts) {
      let best = 0;
      for (const { word, own } of qa) {
        const k = own ? 1 : 0.8;
        for (const w of [...title, ...joined]) best = Math.max(best, wordScore(word, w) * k + 0.5);
        for (const w of rest) best = Math.max(best, wordScore(word, w) * k);
      }
      if (best < 1) return; // this typed word finds nothing in the item
      score += best;
    }
    scored.push({ item, score, at });
  });
  return scored.sort((a, b) => b.score - a.score || a.at - b.at).map((s) => s.item);
}

/** Whether a text holds what was typed, read the same forgiving way for letters (no typos: the site's pages and answers). */
export const holds = (text: string, typed: string): boolean => normalise(text).includes(normalise(typed).trim());
