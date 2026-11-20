import { mkAmtText, mkErrorKey } from "@/lib/market/core";
import type { W2Issue } from "@/lib/market/w2";
import { mkErrorText, type MkWords } from "../Market.text";
import type { W2Words } from "../w2.text";

// What the selling screens say when something stands in the way, in the page's language: a thing the form itself
// noticed (lib/market/w2.ts w2Issues) and a refusal a route answered. Every refusal code that can reach these screens
// has plain words: the shared ones (Market.text.ts errors: the limits, adults only, the birth date, a paused account,
// links and phone numbers, photos, the serial number, the declarations, new only, a new account's price ceiling) and,
// for a value that does not fit, the words of the field it is about.

/** A thing the form noticed, in words. */
export function w2IssueText(t: MkWords, m: W2Words, i: Pick<W2Issue, "key" | "n">): string {
  switch (i.key) {
    case "photos": return (i.n ?? 1) > 1 ? m.needPhotos(i.n ?? 1) : m.need.photo;
    case "photos_max": return m.photosFull;
    case "price_max": return m.priceMax(mkAmtText(i.n ?? 0));
    case "link": case "phone": case "new_only": case "declare": case "consent": case "terms": return mkErrorText(t, i.key);
    default: return m.need[i.key] ?? t.errors.input;
  }
}

/** A refusal a route answered ({ok: false, error, detail}), in words. "input" names the value that did not fit, so it
 *  is said in that field's own words; "photos" on its own may mean a photo that is no longer the listing's. */
export function w2RefusalText(t: MkWords, m: W2Words, error: string, detail: string): string {
  if (error === "input") {
    if (detail === "photos") return t.errors.photos;
    if (detail === "declarations") return t.errors.declare;
    return m.need[detail] ?? t.errors.input;
  }
  if (error === "unreadable") return m.unreadable;
  if (error === "full") return m.photosFull;
  return mkErrorText(t, mkErrorKey(error, detail));
}

/** Where an account adds its birth date: My Account, Personal details. A "birth" refusal links there. */
export const W2_BIRTH_HREF = "/account/personal";
