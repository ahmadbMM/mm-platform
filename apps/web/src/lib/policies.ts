import type { StoreLegal } from "./store-settings";

// The site's policies as the footer and the two policy pages give them (the store build, 2026-11-15; CONTRACTS.md
// sections 7 and 8): the footer's own "Policies" column (L12: Terms, Privacy, Returns, Complaints), its trust line without
// the claims the store build replaced (X04: "Maroof verified", since March 2023 the Saudi Business Center authenticates
// e-stores; X03: a returns line other than the one sentence), and the seller's legal identity line (L01). Plain rules,
// no reads, so the footer, the pages and the tests share them.

export type PolicyKey = "terms" | "privacy" | "returns" | "complaints";
/** The Policies column, in the order the footer lists it. /returns and /complaints answer whatever the site's switches say
 *  (proxy.ts POLICY_PAGE), as /privacy does; the Terms are a page staff switch on, left out while it is off. */
export const POLICY_LINKS: readonly { key: PolicyKey; href: string }[] = [
  { key: "terms", href: "/terms" },
  { key: "privacy", href: "/privacy" },
  { key: "returns", href: "/returns" },
  { key: "complaints", href: "/complaints" },
];

export const policyLinks = (hidden: readonly string[]) => POLICY_LINKS.filter((l) => !(l.key === "terms" && hidden.includes("terms")));

/** Whether a link staff put in one of the footer's other columns is one the Policies column already gives: the Terms, the
 *  Privacy Notice, the returns policy (the Help page's Returns tab included) or Complaints, in any of their spellings. */
export function isPolicyHref(href: string): boolean {
  const h = href.trim().toLowerCase().replace(/^https:\/\/(?:www\.)?micromobility\.sa(?=\/)/, "");
  if (/^\/(?:(?:en|ar)\/)?help\/?#returns$/.test(h)) return true;
  return /^\/(?:(?:en|ar)\/)?(?:terms|privacy|returns|complaints)\/?(?:[?#].*)?$/.test(h);
}

/** A column's links without the ones the Policies column gives (no link twice in the footer). */
export const withoutPolicyLinks = <T extends { href: string }>(links: readonly T[]): T[] => links.filter((l) => !isPolicyHref(l.href));

// A trust line the store build replaced, whatever staff saved (the Website editor keeps the list it was given): Maroof
// (the SBC badge stands in its place, L02) and any returns promise (the footer gives the one sentence, X03), read in
// English and in Arabic.
const REPLACED = [/maroof|معروف/i, /\breturns?\b|إرجاع|ارجاع|استرجاع|الاسترجاع|الإرجاع/i];

/** The trust line's texts in the page's language, without the replaced ones. `english` is the same list in English
 *  (item for item), so a line is recognised in any language; a line staff left empty is dropped too. */
export function keptTrust(local: readonly string[], english: readonly string[]): string[] {
  return local.filter((t, i) => {
    const en = english[i] ?? "";
    return !!t.trim() && !REPLACED.some((re) => re.test(t) || re.test(en));
  });
}

export type LegalWords = { cr: string; ecr: string; vat: string; unified: string };
/** The seller's legal identity as one line (L01): legal name · CR no. · e-store CR no. · VAT no., then the unified number
 *  and the registered address the line already had. A value that is not set is not shown at all. */
export function legalParts(legal: StoreLegal, extra: { unified: string; address: string }, w: LegalWords): string[] {
  const v = (s: string) => s.trim();
  return [
    v(legal.legalName),
    v(legal.cr) && `${w.cr} ${v(legal.cr)}`,
    v(legal.ecr) && `${w.ecr} ${v(legal.ecr)}`,
    v(legal.vat) && `${w.vat} ${v(legal.vat)}`,
    v(extra.unified) && `${w.unified} ${v(extra.unified)}`,
    v(extra.address),
  ].filter((x): x is string => !!x);
}

/** The Help page's Returns answers that have both a question and an answer (the Returns page, and the returns pop-up a
 *  product page may open): the staff-edited policy, read whether or not the Help page is switched on. */
export function returnsAnswers(rows: unknown): { q: string; a: string }[] {
  const S = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return (Array.isArray(rows) ? rows : [])
    .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : {}))
    .map((r) => ({ q: S(r.q), a: S(r.a) }))
    .filter((x) => x.q && x.a);
}

/** A WhatsApp address for the site's number: the WhatsApp link staff set, else wa.me with the phone's digits; "" with
 *  neither. As the Help page reads it. */
export function whatsappHref(whatsapp: string, phone: string): string {
  const own = whatsapp.trim();
  if (/^https:\/\//i.test(own)) return own;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 ? `https://wa.me/${digits}` : "";
}

/** The number a wa.me link writes to, as "+966…", or "" when the link names none (a WhatsApp link staff set may be
 *  another number than the phone's, so the card shows the link's own). */
export function waNumber(href: string): string {
  const m = /^https:\/\/(?:wa\.me|api\.whatsapp\.com\/send\/?\?phone=)\/?(\d{9,15})\b/i.exec(href.trim());
  return m ? `+${m[1]}` : "";
}
