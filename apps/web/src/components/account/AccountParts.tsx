import { localHref } from "@/lib/links";

// The account page's three parts (the booking app's switch, the owner, 2026-11-09: "divide the customer my account
// page into 3 separate pages account stats badges"): Account at /account, which opens first, then /account/stats and
// /account/badges. Links, so each part is an address of its own; the open one is the current page.
export type AccountPart = "account" | "stats" | "badges";
export const ACCOUNT_PARTS: readonly AccountPart[] = ["account", "stats", "badges"];
/** The part an /account address names: none is Account; anything else is no part (the page answers 404). */
export function accountPartOf(seg: string[] | undefined): AccountPart | null {
  if (!seg || seg.length === 0) return "account";
  return seg.length === 1 && (seg[0] === "stats" || seg[0] === "badges") ? seg[0] : null;
}
export const accountPartHref = (p: AccountPart) => (p === "account" ? "/account" : `/account/${p}`);

export default function AccountParts({ part, locale, t }: { part: AccountPart; locale: string; t: Record<AccountPart, string> }) {
  return (
    <nav className="acp" aria-label={t.account}>
      {ACCOUNT_PARTS.map((p) => (
        <a key={p} href={localHref(accountPartHref(p), locale)} className={p === part ? "on" : undefined} aria-current={p === part ? "page" : undefined}>{t[p]}</a>
      ))}
    </nav>
  );
}
